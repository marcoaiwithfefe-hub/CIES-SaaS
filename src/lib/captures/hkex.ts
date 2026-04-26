import type { Page } from 'playwright-core';

const HKEX_URLS = {
  tc: 'https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK',
  en: 'https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=en',
};

export interface HkexCaptureInput {
  stockCode: string;
  language?: 'en' | 'tc';
}

export async function captureHkex(page: Page, input: HkexCaptureInput): Promise<Buffer> {
  const url = HKEX_URLS[input.language ?? 'tc'];
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const dismissSelectors = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Accept All")',
    'button:has-text("同意")',
    '.btn-close',
    'button[aria-label="Close"]',
    '.modal .close',
    '.popup-close',
    '.announcement-close',
  ];
  for (const sel of dismissSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ force: true, timeout: 800 });
        await page.waitForTimeout(300).catch(() => {});
      }
    } catch {
      /* try next */
    }
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
  }
  await page.waitForTimeout(800).catch(() => {});

  const searchSelectors =
    (input.language ?? 'tc') === 'en'
      ? [
          'input[placeholder="Code / Keyword"]',
          'input[placeholder*="Code"]',
          'input[name="search"]',
          '.search-input input',
          'input[type="search"]',
        ]
      : [
          'input[placeholder="代號 / 關鍵字"]',
          'input[placeholder*="代號"]',
          'input[name="search"]',
          '.search-input input',
          'input[type="search"]',
        ];
  for (const sel of searchSelectors) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: 'visible', timeout: 3000 });
      await loc.click();
      await loc.fill('');
      await loc.type(input.stockCode, { delay: 80 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200).catch(() => {});
      break;
    } catch {
      /* try next selector */
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150).catch(() => {});

  return (await page.screenshot({ type: 'png', fullPage: false })) as Buffer;
}
