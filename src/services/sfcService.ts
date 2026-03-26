import { CONFIG } from '../config';
import { launchBrowserWithHealing, createStandardContext, ensureUIReady, AutomationException } from './playwrightUtils';

export async function captureSfcScreenshot(fundNames: string[], onProgress?: (msg: string, step: number, total: number) => void): Promise<{ query: string, images: string[], totalMatches: number }[]> {
  let browser;
  try {
    onProgress?.('Launching Browser...', 1, 5);
    browser = await launchBrowserWithHealing();
    const context = await createStandardContext(browser);
    const page = await context.newPage();

    onProgress?.('Navigating to SFC...', 2, 5);
    try {
      await page.goto(CONFIG.SFC.URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e: any) {
      throw new AutomationException({ errorType: 'NAV_FAIL', message: e.message, stage: 'NAVIGATION' });
    }

    await ensureUIReady(page);

    onProgress?.('Loading Tables...', 3, 5);
    // Wait for the tables to load (they are rendered via Handlebars templates)
    try {
      await page.waitForSelector(CONFIG.SFC.SELECTORS.TABLE_CONTAINER, { timeout: 15000 });
    } catch (e: any) {
      console.warn('Table container not found, proceeding anyway');
    }

    // Click Expand All
    try {
      const expandAllBtn = page.locator(CONFIG.SFC.SELECTORS.EXPAND_ALL_BTN).first();
      if (await expandAllBtn.isVisible({ timeout: 5000 })) {
        await expandAllBtn.click({ force: true });
        // Wait a bit for accordion animations and rendering
        await page.waitForTimeout(1500);
      }
    } catch (e: any) {
      console.warn('Expand All button interaction failed', e);
    }

    const results: { query: string, images: string[], totalMatches: number }[] = [];

    onProgress?.('Processing Funds...', 4, 5);
    for (const fundName of fundNames) {
      if (!fundName.trim()) continue;

      try {
        // Find all fund rows using keyword-based match
        const keywords = fundName.toLowerCase().trim().split(/\s+/);
        let fundRows = page.locator(CONFIG.SFC.SELECTORS.ROW);
        
        for (const kw of keywords) {
          // Escape special characters in keyword for regex
          const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          fundRows = fundRows.filter({ hasText: new RegExp(escapedKw, 'i') });
        }
        
        const count = await fundRows.count();
        
        const screenshots: string[] = [];
        if (count > 0) {
          const limit = Math.min(count, 5);
          for (let i = 0; i < limit; i++) {
            const row = fundRows.nth(i);
            // Scroll into view
            await row.scrollIntoViewIfNeeded();
            // Capture screenshot of the row
            const buffer = await row.screenshot();
            screenshots.push(buffer.toString('base64'));
          }
        }
        results.push({ query: fundName, images: screenshots, totalMatches: count });
      } catch (e: any) {
        throw new AutomationException({ errorType: 'SELECTOR_MISSING', message: `Failed processing fund: ${fundName} - ${e.message}`, stage: 'PROCESSING_RESULTS' });
      }
    }

    onProgress?.('Capture Complete', 5, 5);
    return results;
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
