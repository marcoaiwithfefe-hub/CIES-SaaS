import { chromium, Browser, Page } from 'playwright';
import { execSync } from 'child_process';

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

export async function launchBrowserWithHealing(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (error: any) {
    if (error.message && error.message.includes("Executable doesn't exist")) {
      console.log("Chromium executable missing. Attempting to install...");
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        return await chromium.launch({ headless: true });
      } catch (installError: any) {
        throw new AutomationException({
          errorType: 'ENV_FAIL',
          message: `Failed to install Chromium: ${installError.message}`,
          stage: 'BROWSER_LAUNCH'
        });
      }
    }
    throw new AutomationException({
      errorType: 'ENV_FAIL',
      message: `Failed to launch browser: ${error.message}`,
      stage: 'BROWSER_LAUNCH'
    });
  }
}

export async function createStandardContext(browser: Browser) {
  return await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
}

export async function ensureUIReady(page: Page) {
  // Dismiss OneTrust or other common cookie banners non-blockingly
  try {
    const cookieBtn = page.locator('#onetrust-accept-btn-handler, .cookie-accept, [aria-label="Accept Cookies"]');
    if (await cookieBtn.first().isVisible({ timeout: 2000 })) {
      await cookieBtn.first().click({ force: true });
    }
  } catch (e) {
    // Ignore if not found or not clickable
  }
}

export async function robustClick(page: Page, clickSelector: string, waitForSelector: string, stage: string) {
  try {
    const btn = page.locator(clickSelector).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click({ force: true });
    
    try {
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (e) {
      console.log(`First click failed to reveal ${waitForSelector}, retrying...`);
      await btn.click({ force: true });
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 5000 });
    }
  } catch (error: any) {
    throw new AutomationException({
      errorType: 'TIMEOUT',
      message: `Failed to click ${clickSelector} or wait for ${waitForSelector}: ${error.message}`,
      stage
    });
  }
}
