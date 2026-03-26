'use server';

import { z } from 'zod';
import {
  launchBrowserWithHealing,
  createStandardContext,
  ensureUIReady,
  AutomationException,
} from '@/lib/playwright-utils';
import { buildMockCaptureResult } from '@/lib/mock-data';

// ── Input validation (SECURITY: validate before Playwright) ──────────────────
const hkexInputSchema = z.object({
  stockCode: z
    .string()
    .min(1, 'Stock code is required')
    .max(20, 'Stock code too long')
    .regex(/^[0-9A-Za-z.\-]+$/, 'Invalid stock code format'),
  isMockMode: z.boolean().optional().default(false),
});

export type HkexActionInput = z.infer<typeof hkexInputSchema>;

export interface CaptureResult {
  query: string;
  images: string[];
  totalMatches: number;
  timestamp: number;
}

export interface HkexActionResult {
  success: true;
  result: CaptureResult;
}

export interface HkexActionError {
  success: false;
  error: string;
  errorType?: string;
}

const HKEX_URL =
  'https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK';

// ── Server Action ────────────────────────────────────────────────────────────
export async function captureHkex(
  rawInput: HkexActionInput
): Promise<HkexActionResult | HkexActionError> {
  // 1. Validate input
  const parsed = hkexInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
      errorType: 'VALIDATION_ERROR',
    };
  }

  const { stockCode, isMockMode } = parsed.data;

  // 2. Mock mode — no browser launched
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 2000)); // simulate delay
    return {
      success: true,
      result: buildMockCaptureResult(stockCode),
    };
  }

  // 3. Real capture
  let browser;
  try {
    browser = await launchBrowserWithHealing();
    const context = await createStandardContext(browser);
    const page = await context.newPage();

    try {
      await page.goto(HKEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: unknown) {
      throw new AutomationException({
        errorType: 'NAV_FAIL',
        message: (e as Error).message,
        stage: 'NAVIGATION',
      });
    }

    await ensureUIReady(page);

    try {
      const searchInput = page.locator('input[placeholder="代號 / 關鍵字"]').first();
      await searchInput.waitFor({ state: 'visible', timeout: 10000 });
      await searchInput.click();
      await searchInput.type(stockCode, { delay: 100 });
      await page.keyboard.press('Enter');

      if (stockCode === '700') {
        await page.waitForSelector('td:has-text("騰訊控股")', { timeout: 10000 });
      } else {
        await page
          .waitForSelector(`td:has-text("${stockCode}")`, { timeout: 10000 })
          .catch(() => {});
      }

      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } catch (e: unknown) {
      throw new AutomationException({
        errorType: 'SELECTOR_MISSING',
        message: (e as Error).message,
        stage: 'SEARCH_INPUT',
      });
    }

    const buffer = await page.screenshot();
    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

    return {
      success: true,
      result: {
        query: stockCode,
        images: [base64],
        totalMatches: 1,
        timestamp: Date.now(),
      },
    };
  } catch (error: unknown) {
    if (error instanceof AutomationException) {
      return {
        success: false,
        error: error.details.message,
        errorType: error.details.errorType,
      };
    }
    return {
      success: false,
      error: (error as Error).message ?? 'Unknown error',
      errorType: 'UNKNOWN',
    };
  } finally {
    if (browser) await browser.close();
  }
}
