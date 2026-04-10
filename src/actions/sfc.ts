'use server';

import { z } from 'zod';
import {
  launchBrowserWithHealing,
  createStealthContext,
  ensureUIReady,
  waitForPageReady,
  FAIL_PLACEHOLDER,
  AutomationException,
} from '@/lib/playwright-utils';
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
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      results: fundNames.map((name) => ({
        query: name,
        images: [FAIL_PLACEHOLDER],
        totalMatches: 0,
        timestamp: Date.now(),
      })),
    };
  }

  let browser;
  try {
    browser = await launchBrowserWithHealing();
    const context = await createStealthContext(browser);
    const page = await context.newPage();

    // ── Step 1: Navigate to SFC CIES page ────────────────────────────────
    console.log('[sfc] Navigating to SFC CIES register...');
    try {
      await page.goto(SFC_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch (e: unknown) {
      const message = (e as Error).message ?? 'Failed to navigate to SFC';
      console.error('[sfc] Navigation failed:', message);
      return {
        success: false,
        error: `Failed to load SFC CIES page: ${message}`,
        errorType: 'NAV_FAIL',
      };
    }

    await ensureUIReady(page);
    await waitForPageReady(page, 6000);

    // ── Step 2: Try to expand all accordion sections ──────────────────────
    try {
      const expandSelectors = [
        '.accordin_expand',
        'button:has-text("Expand All")',
        '[aria-label="Expand All"]',
      ];
      for (const sel of expandSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click({ force: true });
          await page.waitForTimeout(600).catch(() => {});
          break;
        }
      }
    } catch {
      console.warn('[sfc] Expand All not found — table may already be expanded');
    }

    await waitForPageReady(page, 2000);

    // ── Step 3: Capture matching rows per fund name ───────────────────────
    const captureResults: CaptureResult[] = [];

    for (const fundName of fundNames) {
      if (!fundName.trim()) continue;
      console.log(`[sfc] Searching for fund: "${fundName}"`);

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
            try {
              await row.scrollIntoViewIfNeeded();
              await page.waitForTimeout(80).catch(() => {});
              const buf = await row.screenshot({ type: 'png' });
              screenshots.push(`data:image/png;base64,${buf.toString('base64')}`);
            } catch (rowErr) {
              console.warn(`[sfc] Row ${i} screenshot failed:`, (rowErr as Error).message);
            }
          }
        }

        // If no row matches, take a full viewport screenshot of the page
        if (screenshots.length === 0) {
          await page.evaluate(() => window.scrollTo(0, 0));
          const buf = await page.screenshot({ type: 'png', fullPage: false });
          screenshots.push(`data:image/png;base64,${buf.toString('base64')}`);
        }

        captureResults.push({
          query: fundName,
          images: screenshots,
          totalMatches: count,
          timestamp: Date.now(),
        });
      } catch (e: unknown) {
        const message = (e as Error).message ?? 'Unknown fund capture error';
        console.error(`[sfc] Error for fund "${fundName}":`, message);
        return {
          success: false,
          error: `Failed to capture SFC results for fund "${fundName}": ${message}`,
          errorType: e instanceof AutomationException ? e.details.errorType : 'CAPTURE_FAIL',
        };
      }
    }

    return { success: true, results: captureResults };

  } catch (error: unknown) {
    console.error('[sfc] Unhandled error:', error);
    if (error instanceof AutomationException) {
      return { success: false, error: error.details.message, errorType: error.details.errorType };
    }
    return {
      success: false,
      error: (error as Error).message ?? 'Unknown error',
      errorType: 'UNKNOWN',
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
