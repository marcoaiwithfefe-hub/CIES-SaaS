'use server';

import { z } from 'zod';
import {
  launchBrowserWithHealing,
  createStandardContext,
  ensureUIReady,
  waitForPageReady,
  robustClick,
  AutomationException,
} from '@/lib/playwright-utils';
import { buildMockCaptureResult } from '@/lib/mock-data';
import type { CaptureResult } from './hkex';

const afrcInputSchema = z.object({
  searchType: z.enum(['name', 'regNo']),
  searchValue: z.string().min(1, 'Search value required').max(100, 'Too long'),
  isMockMode: z.boolean().optional().default(false),
});

export type AfrcActionInput = z.infer<typeof afrcInputSchema>;

export interface AfrcActionResult {
  success: true;
  result: CaptureResult;
}
export interface AfrcActionError {
  success: false;
  error: string;
  errorType?: string;
}

const AFRC_URL =
  'https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx';

export async function captureAfrc(
  rawInput: AfrcActionInput
): Promise<AfrcActionResult | AfrcActionError> {
  const parsed = afrcInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', '), errorType: 'VALIDATION_ERROR' };
  }

  const { searchType, searchValue, isMockMode } = parsed.data;

  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 2000));
    return { success: true, result: buildMockCaptureResult(searchValue) };
  }

  let browser;
  try {
    browser = await launchBrowserWithHealing();
    const context = await createStandardContext(browser);
    const page = await context.newPage();

    try {
      await page.goto(AFRC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: unknown) {
      throw new AutomationException({ errorType: 'NAV_FAIL', message: (e as Error).message, stage: 'NAVIGATION' });
    }

    await ensureUIReady(page);
    await waitForPageReady(page, 15000);

    try {
      if (searchType === 'name') {
        const input = page.locator('#vNAME').or(page.locator('input[name*="NAME"]')).first();
        await input.waitFor({ state: 'visible', timeout: 15000 });
        await input.fill(searchValue);
      } else {
        const input = page.locator('#vREGNO').or(page.locator('input[name*="REGNO"]')).first();
        await input.waitFor({ state: 'visible', timeout: 15000 });
        await input.fill(searchValue);
      }
    } catch (e: unknown) {
      throw new AutomationException({ errorType: 'SELECTOR_MISSING', message: (e as Error).message, stage: 'SEARCH_INPUT' });
    }

    await robustClick(page, '#BTNUA_SEARCH', '#GridContainerDiv', 'SEARCH_CLICK');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    await page.evaluate(() => window.scrollTo(0, 0));
    const buf = await page.screenshot({ fullPage: true });

    return {
      success: true,
      result: {
        query: searchValue,
        images: [`data:image/png;base64,${buf.toString('base64')}`],
        totalMatches: 1,
        timestamp: Date.now(),
      },
    };
  } catch (error: unknown) {
    if (error instanceof AutomationException) {
      return { success: false, error: error.details.message, errorType: error.details.errorType };
    }
    return { success: false, error: (error as Error).message ?? 'Unknown error', errorType: 'UNKNOWN' };
  } finally {
    if (browser) await browser.close();
  }
}
