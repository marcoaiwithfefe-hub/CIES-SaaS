import { CONFIG } from '../config';
import { launchBrowserWithHealing, createStandardContext, ensureUIReady, AutomationException } from './playwrightUtils';

export async function captureHkexScreenshot(stockCode: string, onProgress?: (msg: string, step: number, total: number) => void): Promise<string> {
  let browser;
  try {
    onProgress?.('Launching Browser...', 1, 4);
    browser = await launchBrowserWithHealing();
    const context = await createStandardContext(browser);
    const page = await context.newPage();

    onProgress?.('Navigating to HKEX...', 2, 4);
    try {
      await page.goto(CONFIG.HKEX.URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: any) {
      throw new AutomationException({ errorType: 'NAV_FAIL', message: e.message, stage: 'NAVIGATION' });
    }

    await ensureUIReady(page);

    onProgress?.(`Searching for Stock Code: ${stockCode}...`, 3, 4);
    try {
      const searchInput = page.locator(CONFIG.HKEX.SELECTORS.SEARCH_INPUT).first();
      await searchInput.waitFor({ state: 'visible', timeout: 10000 });
      
      // Focus First
      await searchInput.click();
      
      // Type with Delay
      await searchInput.type(stockCode, { delay: 100 });
      
      // Force Enter
      await page.keyboard.press('Enter');
      
      // Wait for Row
      if (stockCode === '700') {
        await page.waitForSelector('td:has-text("騰訊控股")', { timeout: 10000 });
      } else {
        await page.waitForSelector(`td:has-text("${stockCode}")`, { timeout: 10000 }).catch(() => {});
      }
      
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } catch (e: any) {
      throw new AutomationException({ errorType: 'SELECTOR_MISSING', message: e.message, stage: 'SEARCH_INPUT' });
    }

    onProgress?.('Capturing Screenshot...', 4, 4);
    const buffer = await page.screenshot();

    return buffer.toString('base64');
  } catch (error: any) {
    if (error instanceof AutomationException) throw error;
    throw new AutomationException({ errorType: 'UNKNOWN', message: error.message || 'Unknown error', stage: 'UNKNOWN' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
