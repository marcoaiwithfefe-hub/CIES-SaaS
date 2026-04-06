import { Browser, BrowserContext, Page } from 'playwright-core';
import https from 'https';
import fs from 'fs';
import path from 'path';
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

// ── CJK font loading (Graceful Degradation) ─────────────────────────────────
const CJK_FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf';
const FONT_DIR = '/tmp/fonts';
const FONT_PATH = path.join(FONT_DIR, 'NotoSansCJKsc-Regular.otf');
const FONTCONFIG_PATH = path.join(FONT_DIR, 'fonts.conf');

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        if (!redirect) return reject(new Error('Redirect with no location'));
        return downloadFile(redirect, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function loadCJKFont(chromiumModule: Record<string, unknown>): Promise<void> {
  // Method 1: Use built-in font() if available
  if (typeof chromiumModule.font === 'function') {
    console.log('[playwright-utils] Loading CJK font via chromium.font()');
    await chromiumModule.font(CJK_FONT_URL);
    return;
  }

  // Method 2: Manual download to /tmp/fonts/
  if (fs.existsSync(FONT_PATH)) {
    console.log('[playwright-utils] CJK font already cached at', FONT_PATH);
    return;
  }

  console.log('[playwright-utils] Downloading CJK font manually to /tmp/fonts/');
  fs.mkdirSync(FONT_DIR, { recursive: true });
  await downloadFile(CJK_FONT_URL, FONT_PATH);

  // Write fontconfig so Chromium discovers the font
  const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig><dir>/tmp/fonts</dir></fontconfig>`;
  fs.writeFileSync(FONTCONFIG_PATH, fontsConf);
  process.env.FONTCONFIG_PATH = FONT_DIR;

  console.log('[playwright-utils] CJK font installed at', FONT_PATH);
}

// ── Browser launch ────────────────────────────────────────────────────────────
// On Vercel/Lambda: uses @sparticuz/chromium (serverless-compatible binary).
// Locally: dynamically imports playwright (devDependency) which bundles Chromium.
export async function launchBrowserWithHealing(): Promise<Browser> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    console.log('[playwright-utils] Serverless env — using @sparticuz/chromium');

    // Kill any lingering Chromium process from a previous warm-container invocation.
    // sparticuz uses --single-process so the browser is a single OS process that can
    // take 1-3s to fully exit after browser.close(). A rapid second request on the
    // same warm container would launch a second Chromium before the first fully dies,
    // causing OOM / "browserContext.newPage: Target page, context or browser has been closed".
    try {
      execSync('pkill -f chromium', { timeout: 2000 });
      await new Promise((r) => setTimeout(r, 500)); // let it fully exit
      console.log('[playwright-utils] Killed lingering Chromium process');
    } catch {
      // pkill exits with code 1 when no process found — that's fine, means clean state
    }

    try {
      const [{ default: sparticuz }, { chromium }] = await Promise.all([
        import('@sparticuz/chromium'),
        import('playwright-core'),
      ]);
      // Graceful Degradation: font failure should not block browser launch
      try {
        await loadCJKFont(sparticuz as unknown as Record<string, unknown>);
      } catch (fontError: unknown) {
        console.warn('[playwright-utils] CJK font loading failed (non-fatal):', (fontError as Error).message);
      }
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
