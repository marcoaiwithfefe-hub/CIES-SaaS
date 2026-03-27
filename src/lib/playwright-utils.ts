import { chromium, Browser, BrowserContext, Page } from 'playwright';
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

// ── Anti-bot detection hardening ─────────────────────────────────────────────
// Matches a real Chrome 120 on macOS — used by all context.newPage() calls
export const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const STANDARD_VIEWPORT = { width: 1280, height: 720 };

// ── "Capture Failed" SVG placeholder ─────────────────────────────────────────
// Returned instead of a broken icon when Playwright fails to load the page
const FAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#131b2e"/>
  <rect x="40" y="40" width="1200" height="640" rx="12" fill="#171f33" stroke="#3e484f" stroke-width="1"/>
  <text x="640" y="320" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#87929a" text-anchor="middle">Capture Failed</text>
  <text x="640" y="380" font-family="Inter,sans-serif" font-size="24" fill="#3e484f" text-anchor="middle">Browser could not load the regulatory page</text>
  <text x="640" y="420" font-family="Inter,sans-serif" font-size="18" fill="#3e484f" text-anchor="middle">Check network access and try again</text>
</svg>`;

export const FAIL_PLACEHOLDER = `data:image/svg+xml;base64,${Buffer.from(FAIL_SVG).toString('base64')}`;

// ── Browser launch (self-healing Chromium install) ────────────────────────────
export async function launchBrowserWithHealing(): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,720',
      ],
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.includes("Executable doesn't exist")) {
      console.log('[playwright-utils] Chromium missing — auto-installing...');
      try {
        execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
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

// ── Hardened context — looks like a real Chrome user ─────────────────────────
export async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: STANDARD_VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: STEALTH_USER_AGENT,
    locale: 'zh-HK',
    timezoneId: 'Asia/Hong_Kong',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    },
  });

  // Mask automation signals
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-HK', 'zh', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  return context;
}

// ── Legacy alias (for SFC/AFRC which use standard context) ───────────────────
export const createStandardContext = createStealthContext;

// ── Wait for page to be truly ready ──────────────────────────────────────────
export async function waitForPageReady(page: Page, timeout = 8000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // networkidle may not fire on heavy SPAs — domcontentloaded is enough
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
    } catch {
      // Best-effort — proceed with screenshot
    }
  }
  // Small buffer to let final paint settle
  await page.waitForTimeout(800);
}

// ── Cookie / consent banner dismissal ────────────────────────────────────────
export async function ensureUIReady(page: Page): Promise<void> {
  const ACCEPT_SELECTORS = [
    '#onetrust-accept-btn-handler',
    '[data-testid="accept-all-cookies"]',
    'button:has-text("Accept All")',
    'button:has-text("I Accept")',
    'button:has-text("同意")',
    '.cookie-accept',
  ];
  for (const sel of ACCEPT_SELECTORS) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ force: true, timeout: 2000 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      // Not found — try next
    }
  }
}

// ── Robust click with retry ───────────────────────────────────────────────────
export async function robustClick(
  page: Page,
  clickSelector: string,
  waitForSelector: string,
  stage: string
): Promise<void> {
  try {
    const btn = page.locator(clickSelector).first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await btn.click({ force: true });
    try {
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      // Retry once if first click failed to trigger expected state
      await btn.click({ force: true });
      await page.locator(waitForSelector).first().waitFor({ state: 'visible', timeout: 8000 });
    }
  } catch (error: unknown) {
    throw new AutomationException({
      errorType: 'TIMEOUT',
      message: `robustClick(${clickSelector}): ${(error as Error).message}`,
      stage,
    });
  }
}
