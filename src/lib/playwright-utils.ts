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
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.includes("Executable doesn't exist")) {
      console.log('[playwright-utils] Chromium missing, installing...');
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        return await chromium.launch({ headless: true });
      } catch (installError: unknown) {
        throw new AutomationException({
          errorType: 'ENV_FAIL',
          message: `Failed to install Chromium: ${(installError as Error).message}`,
          stage: 'BROWSER_LAUNCH',
        });
      }
    }
    throw new AutomationException({
      errorType: 'ENV_FAIL',
      message: `Failed to launch browser: ${err.message}`,
      stage: 'BROWSER_LAUNCH',
    });
  }
}

export async function createStandardContext(browser: Browser) {
  return await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    // Security: no credentials stored in context
    storageState: undefined,
  });
}

export async function ensureUIReady(page: Page) {
  try {
    const cookieBtn = page.locator(
      '#onetrust-accept-btn-handler, .cookie-accept, [aria-label="Accept Cookies"]'
    );
    if (await cookieBtn.first().isVisible({ timeout: 2000 })) {
      await cookieBtn.first().click({ force: true });
    }
  } catch {
    // Ignore — cookie banner may not be present
  }
}

export async function robustClick(
  page: Page,
  clickSelector: string,
  waitForSelector: string,
  stage: string
) {
  try {
    const btn = page.locator(clickSelector).first();
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click({ force: true });

    try {
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Retry once
      await btn.click({ force: true });
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 5000 });
    }
  } catch (error: unknown) {
    throw new AutomationException({
      errorType: 'TIMEOUT',
      message: `Failed to click ${clickSelector} or wait for ${waitForSelector}: ${(error as Error).message}`,
      stage,
    });
  }
}
