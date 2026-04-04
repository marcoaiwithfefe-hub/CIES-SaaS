import { Browser, BrowserContext, Page } from 'playwright-core';

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

export const STANDARD_VIEWPORT = { width: 1536, height: 864 };

// ── "Capture Failed" SVG placeholder ─────────────────────────────────────────
// Returned instead of a broken icon when Playwright fails to load the page
const FAIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="864" viewBox="0 0 1536 864">
  <rect width="1536" height="864" fill="#131b2e"/>
  <rect x="40" y="40" width="1456" height="784" rx="12" fill="#171f33" stroke="#3e484f" stroke-width="1"/>
  <text x="768" y="390" font-family="Inter,sans-serif" font-size="48" font-weight="700" fill="#87929a" text-anchor="middle">Capture Failed</text>
  <text x="768" y="450" font-family="Inter,sans-serif" font-size="24" fill="#3e484f" text-anchor="middle">Browser could not load the regulatory page</text>
  <text x="768" y="490" font-family="Inter,sans-serif" font-size="18" fill="#3e484f" text-anchor="middle">Check network access and try again</text>
</svg>`;

export const FAIL_PLACEHOLDER = `data:image/svg+xml;base64,${Buffer.from(FAIL_SVG).toString('base64')}`;

const LOCAL_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--window-size=1536,864',
];

// ── Browser launch ────────────────────────────────────────────────────────────
// On Vercel/Lambda: uses @sparticuz/chromium (serverless-compatible binary).
// Locally: dynamically imports playwright (devDependency) which bundles Chromium.
export async function launchBrowserWithHealing(): Promise<Browser> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    console.log('[playwright-utils] Serverless env — using @sparticuz/chromium');
    try {
      const [{ default: sparticuz }, { chromium }] = await Promise.all([
        import('@sparticuz/chromium'),
        import('playwright-core'),
      ]);
      // Load CJK fonts so Chinese characters render correctly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sparticuz as any).font(
        'https://raw.githack.com/nicholasgasior/gcp-fonts/master/fonts/noto-sans-cjk-hk/NotoSansCJKhk-Regular.otf'
      );
      return await chromium.launch({
        args: sparticuz.args,
        executablePath: await sparticuz.executablePath(),
        headless: true,
      });
    } catch (error: unknown) {
      throw new AutomationException({
        errorType: 'ENV_FAIL',
        message: `Serverless Chromium launch failed: ${(error as Error).message}`,
        stage: 'BROWSER_LAUNCH',
      });
    }
  }

  // Local dev — playwright (devDependency) bundles its own Chromium
  try {
    const { chromium } = await import('playwright');
    return await chromium.launch({ headless: true, args: LOCAL_ARGS });
  } catch (error: unknown) {
    throw new AutomationException({
      errorType: 'ENV_FAIL',
      message: `Failed to launch browser: ${(error as Error).message}. Run: npx playwright install chromium`,
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
