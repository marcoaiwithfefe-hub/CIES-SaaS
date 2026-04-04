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

// ── Zod input validation ──────────────────────────────────────────────────────
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
  images: string[];    // data:image/png;base64,… strings ready for <img src>
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

// HKEX equity search — Chinese language version has the most data
const HKEX_URL =
  'https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK';

// ── Server Action ─────────────────────────────────────────────────────────────
export async function captureHkex(
  rawInput: HkexActionInput
): Promise<HkexActionResult | HkexActionError> {
  // 1. Validate
  const parsed = hkexInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
      errorType: 'VALIDATION_ERROR',
    };
  }

  const { stockCode, isMockMode } = parsed.data;

  // 2. Mock mode — immediate return, no browser
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 1500));
    return {
      success: true,
      result: {
        query: stockCode,
        images: [FAIL_PLACEHOLDER.replace('Capture Failed', 'Mock Mode Active')],
        totalMatches: 1,
        timestamp: Date.now(),
      },
    };
  }

  // 3. Live Playwright capture
  let browser;
  try {
    browser = await launchBrowserWithHealing();
    const context = await createStealthContext(browser);
    const page = await context.newPage();

    // ── Step 1: Navigate to HKEX equities page ────────────────────────────
    console.log(`[hkex] Navigating to HKEX for stock: ${stockCode}`);
    try {
      await page.goto(HKEX_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e: unknown) {
      console.error('[hkex] Navigation failed:', (e as Error).message);
      // Return placeholder instead of broken icon
      return {
        success: true,
        result: {
          query: stockCode,
          images: [FAIL_PLACEHOLDER],
          totalMatches: 0,
          timestamp: Date.now(),
        },
      };
    }

    // ── Step 2: Dismiss cookie banners ────────────────────────────────────
    await ensureUIReady(page);

    // ── Step 2b: Dismiss HKEX-specific notice/disclaimer banners ─────────
    const hkexCloseSelectors = [
      '.btn-close',                          // Bootstrap close button
      'button[aria-label="Close"]',
      '.modal .close',
      '.popup-close',
      '#onetrust-close-btn-container button',
      '.announcement-close',
      'a.close',
    ];
    for (const sel of hkexCloseSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click({ force: true, timeout: 2000 });
          await page.waitForTimeout(500);
        }
      } catch {
        // Not found — try next
      }
    }

    // ── Step 3: Wait for the page to fully render before interacting ──────
    await waitForPageReady(page, 10000);

    // ── Step 4: Search for the stock code ─────────────────────────────────
    try {
      // HKEX uses a Chinese-language placeholder on the search box
      const searchSelectors = [
        'input[placeholder="代號 / 關鍵字"]',
        'input[placeholder*="代號"]',
        'input[name="search"]',
        '.search-input input',
        'input[type="search"]',
      ];

      let searchInput = null;
      for (const sel of searchSelectors) {
        const loc = page.locator(sel).first();
        try {
          await loc.waitFor({ state: 'visible', timeout: 4000 });
          searchInput = loc;
          break;
        } catch {
          continue;
        }
      }

      if (searchInput) {
        await searchInput.click();
        await page.waitForTimeout(300);
        await searchInput.fill('');
        // Type with realistic human delay
        await searchInput.type(stockCode, { delay: 120 });
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');

        // Wait for results to appear
        await page.waitForTimeout(2500);
        await waitForPageReady(page, 8000);
      } else {
        console.warn('[hkex] Search input not found — capturing full page anyway');
      }
    } catch (e: unknown) {
      console.warn('[hkex] Search step warning:', (e as Error).message);
      // Continue — take a screenshot of whatever is visible
    }

    // ── Step 5: Scroll to top and capture ─────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const buffer = await page.screenshot({
      type: 'png',
      fullPage: false,       // viewport-only = 1280×720, matches requirement
    });

    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
    console.log(`[hkex] Screenshot captured for ${stockCode} (${Math.round(buffer.length / 1024)} KB)`);

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
    console.error('[hkex] Unhandled error:', error);
    if (error instanceof AutomationException) {
      // Return placeholder image instead of error for better UX
      return {
        success: true,
        result: {
          query: stockCode,
          images: [FAIL_PLACEHOLDER],
          totalMatches: 0,
          timestamp: Date.now(),
        },
      };
    }
    return {
      success: false,
      error: (error as Error).message ?? 'Unknown error',
      errorType: 'UNKNOWN',
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
