import type { BrowserContext, Page, Browser } from 'playwright-core';

export interface AutomationError {
  errorType: 'TIMEOUT' | 'SELECTOR_MISSING' | 'NAV_FAIL' | 'ENV_FAIL' | 'UNKNOWN';
  message: string;
  stage: string;
}

export class AutomationException extends Error {
  constructor(public details: AutomationError) {
    super(details.message);
    this.name = 'AutomationException';
  }
}

export const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const STANDARD_VIEWPORT = { width: 1536, height: 864 };

export async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: STANDARD_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: STEALTH_USER_AGENT,
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-HK', 'zh', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  return context;
}

export async function robustClick(
  page: Page,
  clickSelector: string,
  waitForSelector: string,
  stage: string,
): Promise<void> {
  try {
    const btn = page.locator(clickSelector).first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click({ force: true });
    try {
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      await btn.click({ force: true });
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 10000 });
    }
  } catch (error) {
    throw new AutomationException({
      errorType: 'TIMEOUT',
      message: `robustClick(${clickSelector}): ${(error as Error).message}`,
      stage,
    });
  }
}

export async function clipScreenshot(page: Page): Promise<Buffer> {
  try {
    return (await page.screenshot({ type: 'png', fullPage: true })) as Buffer;
  } catch {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => 4096);
    const height = Math.min(scrollHeight, 4096);
    return (await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: STANDARD_VIEWPORT.width, height },
    })) as Buffer;
  }
}
