import { CONFIG } from '../config';
import { launchBrowserWithHealing, createStandardContext, ensureUIReady, robustClick, AutomationException } from './playwrightUtils';

export async function captureAfrcFirmScreenshot(searchType: 'enName' | 'chName' | 'regNo', searchValue: string, onProgress?: (msg: string, step: number, total: number) => void): Promise<string> {
  let browser;
  try {
    onProgress?.('Launching Browser...', 1, 4);
    browser = await launchBrowserWithHealing();
    const context = await createStandardContext(browser);
    const page = await context.newPage();

    onProgress?.('Navigating to AFRC Firm...', 2, 4);
    try {
      await page.goto(CONFIG.AFRC_FIRM.URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: any) {
      throw new AutomationException({ errorType: 'NAV_FAIL', message: e.message, stage: 'NAVIGATION' });
    }

    await ensureUIReady(page);

    onProgress?.(`Searching for ${searchValue}...`, 3, 4);
    try {
      // Fill the appropriate input field
      // Note: The prompt specified IDs iEnName, iChName, iRegNo, but the actual DOM uses vNAME, vCHINESENAME, vREGNO.
      // We use the actual DOM IDs to ensure the automation succeeds.
      if (searchType === 'enName') {
        const enNameInput = page.locator(CONFIG.AFRC_FIRM.SELECTORS.EN_NAME_INPUT).or(page.locator('input[name*="NAME"]')).first();
        await enNameInput.waitFor({ state: 'visible', timeout: 5000 });
        await enNameInput.fill(searchValue);
      } else if (searchType === 'chName') {
        const chNameInput = page.locator(CONFIG.AFRC_FIRM.SELECTORS.CH_NAME_INPUT).or(page.locator('input[name*="CHINESENAME"]')).first();
        await chNameInput.waitFor({ state: 'visible', timeout: 5000 });
        await chNameInput.fill(searchValue);
      } else if (searchType === 'regNo') {
        const regNoInput = page.locator(CONFIG.AFRC_FIRM.SELECTORS.REG_NO_INPUT).or(page.locator('input[name*="REGNO"]')).first();
        await regNoInput.waitFor({ state: 'visible', timeout: 5000 });
        await regNoInput.fill(searchValue);
      }
    } catch (e: any) {
      throw new AutomationException({ errorType: 'SELECTOR_MISSING', message: `Failed to find or fill input: ${e.message}`, stage: 'SEARCH_INPUT' });
    }

    // Click the search button and wait for results
    await robustClick(page, CONFIG.AFRC_FIRM.SELECTORS.SEARCH_BTN, CONFIG.AFRC_FIRM.SELECTORS.RESULTS_CONTAINER, 'SEARCH_CLICK');

    // Wait for network to be idle to ensure grid is fully populated
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    onProgress?.('Capturing Screenshot...', 4, 4);
    // Scroll to top to ensure logo and form are in view
    await page.evaluate(() => window.scrollTo(0, 0));

    // Capture full page screenshot to ensure results are included
    const buffer = await page.screenshot({ fullPage: true });
    return buffer.toString('base64');

  } catch (error: any) {
    if (error instanceof AutomationException) {
      throw error;
    }
    throw new AutomationException({ errorType: 'UNKNOWN', message: error.message || 'Unknown error', stage: 'UNKNOWN' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
