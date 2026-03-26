'use server';

import { z } from 'zod';
import {
  launchBrowserWithHealing,
  createStandardContext,
  ensureUIReady,
  AutomationException,
} from '@/lib/playwright-utils';
import { buildMockCaptureResult } from '@/lib/mock-data';
import type { CaptureResult } from './hkex';

const sfcInputSchema = z.object({
  fundNames: z
    .array(
      z.string().min(1).max(200).regex(/^[\w\s\-().&,]+$/, 'Invalid fund name')
    )
    .min(1, 'At least one fund name required')
    .max(10, 'Maximum 10 fund names per request'),
  isMockMode: z.boolean().optional().default(false),
});

export type SfcActionInput = z.infer<typeof sfcInputSchema>;

export interface SfcActionResult {
  success: true;
  results: CaptureResult[];
}

export interface SfcActionError {
  success: false;
  error: string;
  errorType?: string;
}

const SFC_URL =
  'https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES';

export async function captureSfc(
  rawInput: SfcActionInput
): Promise<SfcActionResult | SfcActionError> {
  const parsed = sfcInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
      errorType: 'VALIDATION_ERROR',
    };
  }

  const { fundNames, isMockMode } = parsed.data;

  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 2000));
    return {
      success: true,
      results: fundNames.map((name) => buildMockCaptureResult(name)),
    };
  }

  let browser;
  try {
    browser = await launchBrowserWithHealing();
    const context = await createStandardContext(browser);
    const page = await context.newPage();

    try {
      await page.goto(SFC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: unknown) {
      throw new AutomationException({ errorType: 'NAV_FAIL', message: (e as Error).message, stage: 'NAVIGATION' });
    }

    await ensureUIReady(page);

    // Wait for table and expand all
    try {
      await page.waitForSelector('.table-container table', { timeout: 15000 });
    } catch {
      console.warn('[sfc-action] table not found, proceeding');
    }

    try {
      const expandBtn = page.locator('.accordin_expand').first();
      if (await expandBtn.isVisible({ timeout: 5000 })) {
        await expandBtn.click({ force: true });
        await page.waitForTimeout(1500);
      }
    } catch {
      console.warn('[sfc-action] Expand All failed');
    }

    const captureResults: CaptureResult[] = [];

    for (const fundName of fundNames) {
      if (!fundName.trim()) continue;
      try {
        const keywords = fundName.toLowerCase().trim().split(/\s+/);
        let fundRows = page.locator('tr');

        for (const kw of keywords) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          fundRows = fundRows.filter({ hasText: new RegExp(escaped, 'i') });
        }

        const count = await fundRows.count();
        const screenshots: string[] = [];

        if (count > 0) {
          const limit = Math.min(count, 5);
          for (let i = 0; i < limit; i++) {
            const row = fundRows.nth(i);
            await row.scrollIntoViewIfNeeded();
            const buf = await row.screenshot();
            screenshots.push(`data:image/png;base64,${buf.toString('base64')}`);
          }
        }

        captureResults.push({ query: fundName, images: screenshots, totalMatches: count, timestamp: Date.now() });
      } catch (e: unknown) {
        throw new AutomationException({
          errorType: 'SELECTOR_MISSING',
          message: `Fund "${fundName}": ${(e as Error).message}`,
          stage: 'PROCESSING_RESULTS',
        });
      }
    }

    return { success: true, results: captureResults };
  } catch (error: unknown) {
    if (error instanceof AutomationException) {
      return { success: false, error: error.details.message, errorType: error.details.errorType };
    }
    return { success: false, error: (error as Error).message ?? 'Unknown error', errorType: 'UNKNOWN' };
  } finally {
    if (browser) await browser.close();
  }
}
