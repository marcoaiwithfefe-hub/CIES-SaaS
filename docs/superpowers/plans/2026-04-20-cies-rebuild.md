# CIES Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vercel-serverless Playwright runtime with a persistent Oracle Cloud VM running one long-lived Chromium, eliminating the serverless-specific bug class while preserving all 4 tools and adding bulk capture, ZIP download, SFC EN/中文 toggle, 24 h history, clipboard support, and a `/logs` viewer.

**Architecture:** Next.js 15 on a Docker container on an Oracle Cloud Always Free ARM VM. Module-level browser singleton + concurrency semaphore (cap 12) + 30 s watchdog + 24 h self-restart. Fresh `BrowserContext` per request. Route Handlers replace Server Actions. Filesystem (`/data/captures/` + `/data/logs/captures.log`) for 24 h persistence — no database. Cloudflare Tunnel for HTTPS and public URL.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, Playwright (official Microsoft Docker image `mcr.microsoft.com/playwright:v1.57.0-jammy-arm64`), JSZip, `p-limit`, Cloudflare Tunnel, Docker, `systemd`, Ubuntu 22.04 ARM64.

**Testing posture:** No unit tests (see spec §8). Each task verifies via `npm run build`, `npm run type-check`, `npm run lint`, dev-server smoke, and — for capture tasks — a real hit against the target regulatory site.

**Reference spec:** `docs/superpowers/specs/2026-04-20-cies-rebuild-design.md`

---

## File structure

### New files to create

**Infrastructure:**
- `Dockerfile` — container definition (Playwright base image + Node app)
- `.dockerignore` — exclude node_modules/.next from build context
- `scripts/deploy-oracle.sh` — one-shot VM setup (Docker, git clone, build, systemd, cloudflared)
- `scripts/cleanup-temp.sh` — remove scripts/smoke.ts and other temp files at rebuild start

**Backend lib (new):**
- `src/lib/browser-singleton.ts` — persistent Chromium + watchdog + dev-mode hot-reload safety
- `src/lib/semaphore.ts` — concurrency cap (wraps `p-limit`)
- `src/lib/capture-store.ts` — disk persistence of captures with 24 h cleanup
- `src/lib/capture-log.ts` — JSONL append-only logger
- `src/lib/self-ping.ts` — hourly health self-ping to prevent Oracle idle reclaim
- `src/lib/captures/hkex.ts` — HKEX capture function (accepts `page`, returns image buffer)
- `src/lib/captures/sfc.ts` — SFC capture function with `language` parameter
- `src/lib/captures/afrc.ts` — AFRC Individual capture function
- `src/lib/captures/afrc-firm.ts` — AFRC Firm capture function
- `src/lib/run-capture.ts` — orchestrator: acquires semaphore, opens context, invokes capture fn, logs, stores, retries-once on nav fail

**API routes:**
- `src/app/api/capture/hkex/route.ts`
- `src/app/api/capture/sfc/route.ts`
- `src/app/api/capture/afrc/route.ts`
- `src/app/api/capture/afrc-firm/route.ts`
- `src/app/api/history/route.ts` — list history
- `src/app/api/history/[id]/image/route.ts` — stream stored PNG
- `src/app/api/health/route.ts` — health JSON

**Frontend:**
- `src/app/logs/page.tsx` — read-only log viewer
- `src/components/shared/LanguageToggle.tsx` — EN/中文 pill
- `src/components/shared/BulkInput.tsx` — multiline textarea (one name per line, ≤10)
- `src/components/shared/ScreenshotActions.tsx` — Download / Copy / View buttons
- `src/components/shared/DownloadZipButton.tsx` — JSZip wrapper for "Download all as ZIP"
- `src/components/shared/RecentCaptures.tsx` — 24 h history strip

### Files to modify
- `package.json` — remove `@sparticuz/chromium`; add `p-limit`
- `src/env.ts` — drop `GEMINI_API_KEY` (never read by any action)
- `src/lib/playwright-utils.ts` — slim to stealth context + `robustClick` + texture-fallback helper
- `src/components/panels/HkexPanel.tsx`, `SfcPanel.tsx`, `AfrcPanel.tsx`, `AfrcFirmPanel.tsx` — migrate to Route Handler `fetch()` calls + new shared components
- `src/components/layout/ToolWorkspace.tsx` — no behavioral change, but ensure keep-alive preserved after refactor

### Files to delete
- `vercel.json`
- `src/actions/hkex.ts`, `sfc.ts`, `afrc.ts`, `afrc-firm.ts` (after Phase 4)
- `src/lib/mock-data.ts`
- `scripts/smoke.ts` (throwaway diagnostic from brainstorming)
- `test-playwright.ts` (referenced in CLAUDE.md as manual harness; obsolete after rebuild)

---

# Phase 0 — Clean the decks

## Task 1: Strip Vercel/serverless vestiges

**Files:**
- Delete: `vercel.json`
- Delete: `src/lib/mock-data.ts`
- Delete: `scripts/smoke.ts`
- Delete: `test-playwright.ts`
- Modify: `package.json`
- Modify: `src/env.ts:15-21`
- Modify: `src/actions/hkex.ts`, `sfc.ts`, `afrc.ts`, `afrc-firm.ts` (remove `isMockMode` from inputs; keep the files — they're removed in Phase 4 after UI migrates)

- [ ] **Step 1: Remove `@sparticuz/chromium`, add `p-limit`**

Run:
```bash
cd /Users/marcoaiwithfefe/Desktop/CIES-SaaS
npm uninstall @sparticuz/chromium
npm install p-limit
```

Expected: `package.json` no longer lists `@sparticuz/chromium`; `p-limit` appears under dependencies.

- [ ] **Step 2: Drop GEMINI_API_KEY from env schema**

Edit `src/env.ts`, replace the `GEMINI_API_KEY` block with nothing:

```ts
const serverSchema = z.object({
  INTERNAL_API_SECRET: z.string().min(32, {
    message: 'INTERNAL_API_SECRET must be at least 32 characters for cryptographic safety',
  }),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});
```

- [ ] **Step 3: Remove `isMockMode` from all four action input schemas**

For each of `src/actions/hkex.ts`, `sfc.ts`, `afrc.ts`, `afrc-firm.ts`:
1. Delete the `isMockMode: z.boolean().optional().default(false)` line from the Zod schema.
2. Delete the `if (isMockMode) { ... }` block.
3. Delete any import from `@/lib/mock-data`.

- [ ] **Step 4: Delete the obsolete files**

Run:
```bash
rm vercel.json src/lib/mock-data.ts scripts/smoke.ts test-playwright.ts
```

- [ ] **Step 5: Verify build + type-check still pass**

Run:
```bash
npm run type-check && npm run lint && npm run build
```

Expected: all three succeed. If type-check fails, likely an `isMockMode` reference was missed — grep and fix.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: strip Vercel + mock-mode vestiges before rebuild

Remove @sparticuz/chromium (no longer on serverless), GEMINI_API_KEY
requirement (unused), isMockMode input field (never used in practice),
vercel.json (moving off Vercel), and diagnostic scripts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 1 — Backend foundations

## Task 2: Semaphore

**Files:**
- Create: `src/lib/semaphore.ts`

- [ ] **Step 1: Write the semaphore**

Create `src/lib/semaphore.ts`:

```ts
import pLimit, { LimitFunction } from 'p-limit';

export const MAX_CONCURRENT_CAPTURES = 12;

const limiter: LimitFunction = pLimit(MAX_CONCURRENT_CAPTURES);

export function withCaptureSlot<T>(fn: () => Promise<T>): Promise<T> {
  return limiter(fn);
}

export function getQueueStats(): { active: number; pending: number } {
  return { active: limiter.activeCount, pending: limiter.pendingCount };
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/semaphore.ts
git commit -m "feat(lib): concurrency semaphore for capture slots

Caps in-flight captures at 12. Bulk captures occupy one slot for the
whole batch per spec §6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 3: Browser singleton + watchdog

**Files:**
- Create: `src/lib/browser-singleton.ts`

- [ ] **Step 1: Write the singleton module**

Create `src/lib/browser-singleton.ts`:

```ts
import type { Browser } from 'playwright-core';

const MAX_UPTIME_MS = 24 * 60 * 60 * 1000; // 24 h forced recycle
const HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 s

interface BrowserState {
  browser: Browser | null;
  startedAt: number;
  launching: Promise<Browser> | null;
}

// Use `globalThis` so the singleton survives Next.js dev-mode hot reloads.
const globalForBrowser = globalThis as unknown as {
  __cies_browser_state?: BrowserState;
};

const state: BrowserState =
  globalForBrowser.__cies_browser_state ??
  (globalForBrowser.__cies_browser_state = {
    browser: null,
    startedAt: 0,
    launching: null,
  });

async function launch(): Promise<Browser> {
  // Playwright is a devDependency bundled with Chromium; the Docker image
  // (`mcr.microsoft.com/playwright:v1.57.0-jammy-arm64`) ships the matching browser.
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  state.browser = browser;
  state.startedAt = Date.now();
  return browser;
}

export async function getBrowser(): Promise<Browser> {
  if (state.browser && state.browser.isConnected()) return state.browser;
  if (state.launching) return state.launching;
  state.launching = launch().finally(() => {
    state.launching = null;
  });
  return state.launching;
}

async function respawnIfNeeded(): Promise<void> {
  const current = state.browser;
  const tooOld = current && Date.now() - state.startedAt > MAX_UPTIME_MS;
  const dead = current && !current.isConnected();
  if (!current || tooOld || dead) {
    if (current) {
      await current.close().catch(() => {});
    }
    state.browser = null;
    state.startedAt = 0;
    await getBrowser();
  }
}

let watchdogStarted = false;
export function startWatchdog(): void {
  if (watchdogStarted) return;
  watchdogStarted = true;
  setInterval(() => {
    respawnIfNeeded().catch((err) => {
      console.error('[browser-singleton] watchdog error:', err);
    });
  }, HEALTH_CHECK_INTERVAL_MS);
}

export function getBrowserStats(): { connected: boolean; uptimeSec: number } {
  const connected = !!state.browser?.isConnected();
  const uptimeSec = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
  return { connected, uptimeSec };
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/browser-singleton.ts
git commit -m "feat(lib): browser singleton with watchdog

One Chromium launched lazily on first request, reused across requests.
30s health check + 24h forced recycle. Uses globalThis for Next.js dev
hot-reload safety. Replaces per-request launchBrowserWithHealing().

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 4: Capture store (filesystem persistence)

**Files:**
- Create: `src/lib/capture-store.ts`

- [ ] **Step 1: Write the store**

Create `src/lib/capture-store.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_ROOT = process.env.CIES_DATA_DIR ?? '/data';
const CAPTURES_ROOT = path.join(DATA_ROOT, 'captures');
const RETENTION_MS = 24 * 60 * 60 * 1000;

export type Tool = 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';

export interface StoredCaptureMeta {
  id: string;
  tool: Tool;
  query: string;
  language?: 'en' | 'tc';
  timestamp: number;
}

function datePart(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export interface StoreInput {
  tool: Tool;
  query: string;
  language?: 'en' | 'tc';
  image: Buffer;
}

export async function storeCapture(input: StoreInput): Promise<StoredCaptureMeta> {
  const id = randomUUID();
  const timestamp = Date.now();
  const dir = path.join(CAPTURES_ROOT, input.tool, datePart(timestamp));
  await mkdir(dir, { recursive: true });
  const meta: StoredCaptureMeta = {
    id,
    tool: input.tool,
    query: input.query,
    language: input.language,
    timestamp,
  };
  await Promise.all([
    writeFile(path.join(dir, `${id}.png`), input.image),
    writeFile(path.join(dir, `${id}.json`), JSON.stringify(meta)),
  ]);
  return meta;
}

export async function listHistory(tool: Tool, limit: number): Promise<StoredCaptureMeta[]> {
  const toolDir = path.join(CAPTURES_ROOT, tool);
  const results: StoredCaptureMeta[] = [];
  let dayDirs: string[];
  try {
    dayDirs = await readdir(toolDir);
  } catch {
    return [];
  }
  dayDirs.sort().reverse();
  for (const day of dayDirs) {
    const dayPath = path.join(toolDir, day);
    const files = await readdir(dayPath);
    const metaFiles = files.filter((f) => f.endsWith('.json'));
    for (const f of metaFiles) {
      try {
        const raw = await readFile(path.join(dayPath, f), 'utf8');
        results.push(JSON.parse(raw));
      } catch {
        /* skip corrupt */
      }
    }
    if (results.length >= limit) break;
  }
  return results
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function readImage(id: string): Promise<{ data: Buffer; meta: StoredCaptureMeta } | null> {
  let tools: Tool[];
  try {
    tools = (await readdir(CAPTURES_ROOT)) as Tool[];
  } catch {
    return null;
  }
  for (const tool of tools) {
    const toolDir = path.join(CAPTURES_ROOT, tool);
    let dayDirs: string[];
    try {
      dayDirs = await readdir(toolDir);
    } catch {
      continue;
    }
    for (const day of dayDirs) {
      const imgPath = path.join(toolDir, day, `${id}.png`);
      const metaPath = path.join(toolDir, day, `${id}.json`);
      try {
        const [data, rawMeta] = await Promise.all([readFile(imgPath), readFile(metaPath, 'utf8')]);
        return { data, meta: JSON.parse(rawMeta) };
      } catch {
        /* not here, keep looking */
      }
    }
  }
  return null;
}

export async function cleanup(): Promise<void> {
  const cutoff = Date.now() - RETENTION_MS;
  let tools: string[];
  try {
    tools = await readdir(CAPTURES_ROOT);
  } catch {
    return;
  }
  for (const tool of tools) {
    const toolDir = path.join(CAPTURES_ROOT, tool);
    const days = await readdir(toolDir).catch(() => []);
    for (const day of days) {
      const dayMs = Date.parse(day);
      if (Number.isFinite(dayMs) && dayMs < cutoff - RETENTION_MS) {
        await rm(path.join(toolDir, day), { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

let cleanupStarted = false;
export function startCleanupTimer(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    cleanup().catch((err) => console.error('[capture-store] cleanup:', err));
  }, 15 * 60 * 1000);
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/capture-store.ts
git commit -m "feat(lib): disk-backed capture store with 24h cleanup

Captures land under /data/captures/<tool>/<YYYY-MM-DD>/<uuid>.png
plus matching .json sidecar. 15-min interval cleans directories older
than 24h. CIES_DATA_DIR env var overrides /data root (useful for dev).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 5: Capture log (JSONL)

**Files:**
- Create: `src/lib/capture-log.ts`

- [ ] **Step 1: Write the logger**

Create `src/lib/capture-log.ts`:

```ts
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_ROOT = process.env.CIES_DATA_DIR ?? '/data';
const LOG_FILE = path.join(DATA_ROOT, 'logs', 'captures.log');

export interface CaptureLogEntry {
  t: string; // ISO timestamp
  tool: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
  query: string;
  ok: boolean;
  ms: number;
  stage?: 'launch' | 'navigate' | 'interact' | 'screenshot';
  err?: string;
}

export async function logCapture(entry: CaptureLogEntry): Promise<void> {
  await mkdir(path.dirname(LOG_FILE), { recursive: true });
  await appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readRecentLogs(limit: number): Promise<CaptureLogEntry[]> {
  let raw: string;
  try {
    raw = await readFile(LOG_FILE, 'utf8');
  } catch {
    return [];
  }
  const lines = raw.trim().split('\n').filter(Boolean);
  const recent = lines.slice(-limit);
  return recent
    .map((line) => {
      try {
        return JSON.parse(line) as CaptureLogEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is CaptureLogEntry => x !== null)
    .reverse();
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/capture-log.ts
git commit -m "feat(lib): JSONL capture logger

Appends one JSON line per capture to /data/logs/captures.log. readRecentLogs
tails the last N entries for the /logs viewer. Directory created lazily so
no boot dependency on /data existing.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 2 — Port capture logic out of Server Actions

Capture *logic* moves from `src/actions/*.ts` into `src/lib/captures/*.ts`. Each new file exports a pure function that accepts a Playwright `Page` and the capture input, returns an image `Buffer`. The orchestrator in Task 10 wires it to a new context from the singleton browser.

## Task 6: Port HKEX capture

**Files:**
- Create: `src/lib/captures/hkex.ts`
- Reference: `src/actions/hkex.ts:60-185` for existing logic

- [ ] **Step 1: Extract capture logic into a pure function**

Create `src/lib/captures/hkex.ts`:

```ts
import type { Page } from 'playwright-core';

const HKEX_URL = 'https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK';

export interface HkexCaptureInput {
  stockCode: string;
}

export async function captureHkex(page: Page, input: HkexCaptureInput): Promise<Buffer> {
  await page.goto(HKEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Dismiss cookie + HKEX-specific notice banners.
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

  const searchSelectors = [
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
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/captures/hkex.ts
git commit -m "feat(captures): port HKEX capture to pure function

Moves HKEX capture logic from src/actions/hkex.ts into a reusable pure
function that accepts a Playwright Page. Same selector strategy, same
banner dismissal, same viewport screenshot. Timeout budget relaxed now
that Vercel's 60s limit is gone.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 7: Port SFC capture with language parameter

**Files:**
- Create: `src/lib/captures/sfc.ts`
- Reference: `src/actions/sfc.ts` for existing logic

- [ ] **Step 1: Extract SFC capture logic with language support**

Create `src/lib/captures/sfc.ts`:

```ts
import type { Page } from 'playwright-core';

const SFC_URL_EN =
  'https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES';
const SFC_URL_TC =
  'https://www.sfc.hk/tc/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES';

export interface SfcCaptureInput {
  fundNames: string[];
  language: 'en' | 'tc';
}

export interface SfcItemResult {
  query: string;
  image: Buffer | null;
  error?: string;
}

export async function captureSfc(page: Page, input: SfcCaptureInput): Promise<SfcItemResult[]> {
  const url = input.language === 'tc' ? SFC_URL_TC : SFC_URL_EN;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Expand accordion containing the fund table.
  try {
    const accordion = page.locator('.accordin_expand').first();
    if (await accordion.isVisible({ timeout: 5000 })) {
      await accordion.click();
      await page.waitForTimeout(600);
    }
  } catch {
    /* already expanded or different markup */
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    /* best effort */
  }

  const results: SfcItemResult[] = [];
  for (const rawName of input.fundNames) {
    const name = rawName.trim();
    if (!name) continue;
    try {
      const rowLocator = page.locator('tr', { hasText: name }).first();
      await rowLocator.waitFor({ state: 'visible', timeout: 6000 });
      await rowLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const image = (await rowLocator.screenshot({ type: 'png' })) as Buffer;
      results.push({ query: name, image });
    } catch (e) {
      results.push({ query: name, image: null, error: (e as Error).message });
    }
  }
  return results;
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/captures/sfc.ts
git commit -m "feat(captures): port SFC capture with language toggle

Accepts language: 'en' | 'tc' and navigates directly to the corresponding
SFC URL (no in-page language click). Processes fund names sequentially in
one loaded page per spec §5. Per-item failures reported in result array
instead of aborting the batch.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 8: Port AFRC Individual capture

**Files:**
- Create: `src/lib/captures/afrc.ts`
- Reference: `src/actions/afrc.ts` for existing logic

- [ ] **Step 1: Extract AFRC capture**

Create `src/lib/captures/afrc.ts`:

```ts
import type { Page } from 'playwright-core';
import { robustClick, clipScreenshot } from '@/lib/playwright-utils';

const AFRC_URL =
  'https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx';

export interface AfrcCaptureInput {
  searchType: 'name' | 'regNo';
  searchValue: string;
}

export async function captureAfrc(page: Page, input: AfrcCaptureInput): Promise<Buffer> {
  await page.goto(AFRC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    /* best effort */
  }

  const inputSelector = input.searchType === 'name' ? '#vNAME' : '#vREGNO';
  const loc = page.locator(inputSelector).first();
  await loc.waitFor({ state: 'attached', timeout: 10000 });
  await loc.fill(input.searchValue, { force: true });

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    robustClick(page, '#BTNUA_SEARCH', '#GridContainerDiv', 'afrc-search'),
  ]);

  await page.waitForTimeout(800).catch(() => {});
  return clipScreenshot(page);
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run type-check`
Expected: errors on `clipScreenshot` (not yet created — will be added to `playwright-utils.ts` in Task 9 refactor). Leave as-is; Task 9 fixes it.

- [ ] **Step 3: Commit (type-check passing deferred to Task 9)**

```bash
git add src/lib/captures/afrc.ts
git commit -m "feat(captures): port AFRC Individual capture

Uses robustClick + waitForNavigation (the ASP.NET postback fires a full
page load). References clipScreenshot helper added in the next task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 9: Port AFRC Firm capture + slim `playwright-utils.ts`

**Files:**
- Create: `src/lib/captures/afrc-firm.ts`
- Modify: `src/lib/playwright-utils.ts` (slim drastically, add `clipScreenshot`)
- Reference: `src/actions/afrc-firm.ts` for existing logic + GeneXus visibility bypass

- [ ] **Step 1: Slim `playwright-utils.ts` to keep only what's still needed**

Replace the entire contents of `src/lib/playwright-utils.ts` with:

```ts
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

/**
 * Tall AFRC pages can exceed Chrome's GPU texture size. Try fullPage first;
 * on protocol error, measure scrollHeight and clip to min(scrollHeight, 4096).
 */
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
```

- [ ] **Step 2: Create AFRC Firm capture**

Create `src/lib/captures/afrc-firm.ts`:

```ts
import type { Page } from 'playwright-core';
import { robustClick, clipScreenshot } from '@/lib/playwright-utils';

const AFRC_FIRM_URL =
  'https://armies.afrc.org.hk/registration/ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx';

export interface AfrcFirmCaptureInput {
  englishName?: string;
  chineseName?: string;
  regNo?: string;
}

export async function captureAfrcFirm(
  page: Page,
  input: AfrcFirmCaptureInput,
): Promise<Buffer> {
  await page.goto(AFRC_FIRM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    /* best effort */
  }

  // Control IDs per spec §2/§5 and CLAUDE.md — confirmed against live page.
  // AFRC Firm uses GeneXus JS that temporarily hides inputs during init,
  // so wait for 'attached' (DOM) and use fill({force:true}) per commit f9c0257.
  const fills: Array<[string, string | undefined]> = [
    ['#vNAME', input.englishName],
    ['#vCHINESENAME', input.chineseName],
    ['#vREGNO', input.regNo],
  ];
  for (const [sel, value] of fills) {
    if (!value) continue;
    const loc = page.locator(sel).first();
    await loc.waitFor({ state: 'attached', timeout: 10000 });
    await loc.fill(value, { force: true });
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    robustClick(page, '#BTNUA_SEARCH', '#GridContainerDiv', 'afrc-firm-search'),
  ]);
  await page.waitForTimeout(800).catch(() => {});
  return clipScreenshot(page);
}
```

- [ ] **Step 3: Verify type-check + lint + build**

Run:
```bash
npm run type-check && npm run lint && npm run build
```

Expected: all pass. AFRC Individual from Task 8 now compiles.

- [ ] **Step 4: Commit**

```bash
git add src/lib/playwright-utils.ts src/lib/captures/afrc-firm.ts
git commit -m "feat(captures): port AFRC Firm capture, slim playwright-utils

playwright-utils drops launchBrowserWithHealing, pkill hack, font download
dance, ensureUIReady (banner dismissal moved into HKEX capture where it's
needed), waitForPageReady (inlined with try/catch in each capture),
FAIL_PLACEHOLDER (dead code). Keeps stealth context, robustClick, plus new
clipScreenshot helper for the texture-limit fallback.

AFRC Firm preserves the GeneXus visibility bypass from commit f9c0257.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 3 — API Route Handlers

## Task 10: Capture orchestrator + 4 capture routes

**Files:**
- Create: `src/lib/run-capture.ts`
- Create: `src/app/api/capture/hkex/route.ts`
- Create: `src/app/api/capture/sfc/route.ts`
- Create: `src/app/api/capture/afrc/route.ts`
- Create: `src/app/api/capture/afrc-firm/route.ts`

- [ ] **Step 1: Write the orchestrator**

Create `src/lib/run-capture.ts`:

```ts
import type { BrowserContext } from 'playwright-core';
import { getBrowser, startWatchdog } from '@/lib/browser-singleton';
import { createStealthContext } from '@/lib/playwright-utils';
import { withCaptureSlot } from '@/lib/semaphore';
import { storeCapture, startCleanupTimer, type Tool, type StoredCaptureMeta } from '@/lib/capture-store';
import { logCapture } from '@/lib/capture-log';

export interface CaptureResult {
  id: string;
  query: string;
  image: string; // data URI
  timestamp: number;
}

export interface OrchestrateOptions<I> {
  tool: Tool;
  query: string;
  language?: 'en' | 'tc';
  input: I;
  run: (ctx: BrowserContext, input: I) => Promise<Buffer>;
}

// Start background tasks lazily the first time the module is used.
let backgroundStarted = false;
function ensureBackgroundStarted() {
  if (backgroundStarted) return;
  backgroundStarted = true;
  startWatchdog();
  startCleanupTimer();
}

export async function orchestrateCapture<I>(
  opts: OrchestrateOptions<I>,
): Promise<{ success: true; result: CaptureResult } | { success: false; error: string; stage: string }> {
  ensureBackgroundStarted();
  return withCaptureSlot(async () => {
    const t0 = Date.now();
    let stage: 'launch' | 'navigate' | 'interact' | 'screenshot' = 'launch';
    let ctx: BrowserContext | undefined;
    try {
      const browser = await getBrowser();
      ctx = await createStealthContext(browser);
      stage = 'navigate';
      let image: Buffer;
      try {
        image = await opts.run(ctx, opts.input);
      } catch (err) {
        // Silent retry-once for navigation-class failures.
        const msg = (err as Error).message ?? '';
        if (/goto|net::|Timeout.*navigat/i.test(msg)) {
          await ctx.close().catch(() => {});
          ctx = await createStealthContext(browser);
          image = await opts.run(ctx, opts.input);
        } else {
          throw err;
        }
      }
      stage = 'screenshot';
      const meta: StoredCaptureMeta = await storeCapture({
        tool: opts.tool,
        query: opts.query,
        language: opts.language,
        image,
      });
      const ms = Date.now() - t0;
      await logCapture({
        t: new Date().toISOString(),
        tool: opts.tool,
        query: opts.query,
        ok: true,
        ms,
      });
      return {
        success: true as const,
        result: {
          id: meta.id,
          query: opts.query,
          image: `data:image/png;base64,${image.toString('base64')}`,
          timestamp: meta.timestamp,
        },
      };
    } catch (err) {
      const ms = Date.now() - t0;
      const errMsg = (err as Error).message ?? 'unknown';
      await logCapture({
        t: new Date().toISOString(),
        tool: opts.tool,
        query: opts.query,
        ok: false,
        ms,
        stage,
        err: errMsg,
      });
      return { success: false as const, error: errMsg, stage };
    } finally {
      await ctx?.close().catch(() => {});
    }
  });
}
```

- [ ] **Step 2: Write the HKEX route handler**

Create `src/app/api/capture/hkex/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureHkex } from '@/lib/captures/hkex';
import { orchestrateCapture } from '@/lib/run-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  stockCode: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[0-9A-Za-z.\-]+$/, 'Invalid stock code format'),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }
  const result = await orchestrateCapture({
    tool: 'hkex',
    query: parsed.data.stockCode,
    input: parsed.data,
    run: async (ctx, input) => {
      const page = await ctx.newPage();
      return captureHkex(page, input);
    },
  });
  if (result.success) return NextResponse.json({ success: true, results: [result.result] });
  return NextResponse.json(result, { status: 500 });
}
```

- [ ] **Step 3: Write the AFRC route handler**

Create `src/app/api/capture/afrc/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureAfrc } from '@/lib/captures/afrc';
import { orchestrateCapture } from '@/lib/run-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  searchType: z.enum(['name', 'regNo']),
  searchValue: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }
  const result = await orchestrateCapture({
    tool: 'afrc',
    query: parsed.data.searchValue,
    input: parsed.data,
    run: async (ctx, input) => {
      const page = await ctx.newPage();
      return captureAfrc(page, input);
    },
  });
  if (result.success) return NextResponse.json({ success: true, results: [result.result] });
  return NextResponse.json(result, { status: 500 });
}
```

- [ ] **Step 4: Write the AFRC Firm route handler**

Create `src/app/api/capture/afrc-firm/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureAfrcFirm } from '@/lib/captures/afrc-firm';
import { orchestrateCapture } from '@/lib/run-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z
  .object({
    englishName: z.string().max(200).optional(),
    chineseName: z.string().max(200).optional(),
    regNo: z.string().max(100).optional(),
  })
  .refine(
    (v) => Boolean(v.englishName || v.chineseName || v.regNo),
    { message: 'At least one of englishName, chineseName, or regNo is required' },
  );

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }
  const queryLabel = parsed.data.englishName ?? parsed.data.chineseName ?? parsed.data.regNo!;
  const result = await orchestrateCapture({
    tool: 'afrc-firm',
    query: queryLabel,
    input: parsed.data,
    run: async (ctx, input) => {
      const page = await ctx.newPage();
      return captureAfrcFirm(page, input);
    },
  });
  if (result.success) return NextResponse.json({ success: true, results: [result.result] });
  return NextResponse.json(result, { status: 500 });
}
```

- [ ] **Step 5: Write the SFC route handler (bulk-capable)**

Create `src/app/api/capture/sfc/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureSfc } from '@/lib/captures/sfc';
import { getBrowser, startWatchdog } from '@/lib/browser-singleton';
import { createStealthContext } from '@/lib/playwright-utils';
import { withCaptureSlot } from '@/lib/semaphore';
import { storeCapture, startCleanupTimer } from '@/lib/capture-store';
import { logCapture } from '@/lib/capture-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  fundNames: z
    .array(z.string().min(1).max(200).regex(/^[\w\s\-().&,]+$/))
    .min(1)
    .max(10),
  language: z.enum(['en', 'tc']),
});

export async function POST(req: NextRequest) {
  startWatchdog();
  startCleanupTimer();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }

  return withCaptureSlot(async () => {
    const t0 = Date.now();
    const browser = await getBrowser();
    const ctx = await createStealthContext(browser);
    try {
      const page = await ctx.newPage();
      const items = await captureSfc(page, parsed.data);
      const results = [];
      for (const item of items) {
        if (!item.image) {
          await logCapture({
            t: new Date().toISOString(),
            tool: 'sfc',
            query: item.query,
            ok: false,
            ms: 0,
            stage: 'interact',
            err: item.error ?? 'row not matched',
          });
          continue;
        }
        const meta = await storeCapture({
          tool: 'sfc',
          query: item.query,
          language: parsed.data.language,
          image: item.image,
        });
        results.push({
          id: meta.id,
          query: item.query,
          image: `data:image/png;base64,${item.image.toString('base64')}`,
          timestamp: meta.timestamp,
        });
        await logCapture({
          t: new Date().toISOString(),
          tool: 'sfc',
          query: item.query,
          ok: true,
          ms: Date.now() - t0,
        });
      }
      return NextResponse.json({ success: true, results });
    } catch (err) {
      await logCapture({
        t: new Date().toISOString(),
        tool: 'sfc',
        query: parsed.data.fundNames.join(', '),
        ok: false,
        ms: Date.now() - t0,
        stage: 'interact',
        err: (err as Error).message,
      });
      return NextResponse.json(
        { success: false, error: (err as Error).message, stage: 'interact' },
        { status: 500 },
      );
    } finally {
      await ctx.close().catch(() => {});
    }
  });
}
```

- [ ] **Step 6: Verify type-check + lint + build pass**

Run:
```bash
npm run type-check && npm run lint && npm run build
```

Expected: all pass.

- [ ] **Step 7: Smoke-test the HKEX route against the live site**

Install Playwright Chromium if not already present:
```bash
npx playwright install chromium
```

Start dev server:
```bash
INTERNAL_API_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
CIES_DATA_DIR=/tmp/cies-data \
npm run dev
```

In another terminal:
```bash
curl -s -X POST http://localhost:3000/api/capture/hkex \
  -H 'content-type: application/json' \
  -d '{"stockCode":"0005"}' | jq '.success, .results[0].query, (.results[0].image | length)'
```

Expected output:
```
true
"0005"
<a number in the hundreds of thousands>
```

Also confirm the file landed:
```bash
ls /tmp/cies-data/captures/hkex/
```

Expected: a date-named directory containing a `<uuid>.png` + `<uuid>.json`.

Stop the dev server (Ctrl+C).

- [ ] **Step 8: Commit**

```bash
git add src/lib/run-capture.ts src/app/api/capture/
git commit -m "feat(api): Route Handlers for all 4 capture tools

Replaces Server Actions with POST /api/capture/<tool>. All handlers go
through orchestrateCapture (HKEX, AFRC, AFRC Firm) which wraps the
semaphore + browser singleton + retry-once + logging + disk persistence.
SFC uses a bespoke handler because bulk loops internally through one page
load. Response shape matches spec §6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 11: History + health routes

**Files:**
- Create: `src/app/api/history/route.ts`
- Create: `src/app/api/history/[id]/image/route.ts`
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Write history list route**

Create `src/app/api/history/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listHistory, type Tool } from '@/lib/capture-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  tool: z.enum(['hkex', 'sfc', 'afrc', 'afrc-firm']),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }
  const items = await listHistory(parsed.data.tool as Tool, parsed.data.limit);
  const withUrls = items.map((m) => ({
    id: m.id,
    tool: m.tool,
    query: m.query,
    language: m.language,
    timestamp: m.timestamp,
    url: `/api/history/${m.id}/image`,
  }));
  return NextResponse.json({ items: withUrls });
}
```

- [ ] **Step 2: Write image-stream route**

Create `src/app/api/history/[id]/image/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { readImage } from '@/lib/capture-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await readImage(id);
  if (!record) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(record.data as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
```

- [ ] **Step 3: Write health route**

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getBrowserStats, startWatchdog } from '@/lib/browser-singleton';
import { getQueueStats } from '@/lib/semaphore';
import { startCleanupTimer } from '@/lib/capture-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  startWatchdog();
  startCleanupTimer();
  const browser = getBrowserStats();
  const queue = getQueueStats();
  return NextResponse.json({
    ok: true,
    chromium: browser.connected ? 'connected' : 'disconnected',
    uptimeSec: browser.uptimeSec,
    inFlight: queue.active,
    queued: queue.pending,
  });
}
```

- [ ] **Step 4: Verify + smoke**

Run:
```bash
npm run type-check && npm run lint && npm run build
```

Expected: all pass.

Smoke test (dev server still from Task 10):
```bash
curl -s http://localhost:3000/api/health | jq
curl -s 'http://localhost:3000/api/history?tool=hkex&limit=5' | jq
```

Expected: health returns `ok:true`; history returns the HKEX capture from Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/history/ src/app/api/health/
git commit -m "feat(api): history + health Route Handlers

GET /api/history lists metadata with url pointers.
GET /api/history/:id/image streams the stored PNG.
GET /api/health reports browser + queue state for the /logs page
and the self-ping keep-alive.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 12: Self-ping keep-alive

**Files:**
- Create: `src/lib/self-ping.ts`

- [ ] **Step 1: Write the self-ping module**

Create `src/lib/self-ping.ts`:

```ts
const INTERVAL_MS = 60 * 60 * 1000; // 1 h

let started = false;
export function startSelfPing(): void {
  if (started) return;
  if (!process.env.CIES_SELF_PING_URL) return; // disabled unless configured
  started = true;
  const url = process.env.CIES_SELF_PING_URL;
  setInterval(() => {
    fetch(url).catch((err) => console.warn('[self-ping] failed:', (err as Error).message));
  }, INTERVAL_MS);
}
```

Update `src/app/api/health/route.ts` to start self-ping too. Replace the import + startups block:

```ts
import { NextResponse } from 'next/server';
import { getBrowserStats, startWatchdog } from '@/lib/browser-singleton';
import { getQueueStats } from '@/lib/semaphore';
import { startCleanupTimer } from '@/lib/capture-store';
import { startSelfPing } from '@/lib/self-ping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  startWatchdog();
  startCleanupTimer();
  startSelfPing();
  const browser = getBrowserStats();
  const queue = getQueueStats();
  return NextResponse.json({
    ok: true,
    chromium: browser.connected ? 'connected' : 'disconnected',
    uptimeSec: browser.uptimeSec,
    inFlight: queue.active,
    queued: queue.pending,
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/self-ping.ts src/app/api/health/route.ts
git commit -m "feat(lib): hourly self-ping to prevent Oracle idle reclaim

Set CIES_SELF_PING_URL to the deployed /api/health URL; leave unset in
dev to avoid noise. Starts on first /api/health hit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 4 — Frontend

**Invoke `ui-ux-pro-max` skill at the start of this phase.** Apply its guidance to every component created or modified below. Capture its recommendations in-place as code comments or as a short note in the commit body — nothing unwritten.

## Task 13: Shared components

**Files:**
- Create: `src/components/shared/LanguageToggle.tsx`
- Create: `src/components/shared/BulkInput.tsx`
- Create: `src/components/shared/ScreenshotActions.tsx`
- Create: `src/components/shared/DownloadZipButton.tsx`
- Create: `src/components/shared/RecentCaptures.tsx`

- [ ] **Step 1: Invoke ui-ux-pro-max**

Use Skill tool: `ui-ux-pro-max`. Apply its guidance to the components in this task. Document any non-obvious decisions as a one-line comment in the relevant component.

- [ ] **Step 2: `LanguageToggle`**

Create `src/components/shared/LanguageToggle.tsx`:

```tsx
'use client';

type Lang = 'en' | 'tc';

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
}

export function LanguageToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 p-0.5 text-sm"
    >
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={value === 'en'}
        className={`rounded-full px-3 py-1 transition ${
          value === 'en' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300 hover:text-zinc-100'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('tc')}
        aria-pressed={value === 'tc'}
        className={`rounded-full px-3 py-1 transition ${
          value === 'tc' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300 hover:text-zinc-100'
        }`}
      >
        中文
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `BulkInput`**

Create `src/components/shared/BulkInput.tsx`:

```tsx
'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number; // max entries
}

export function BulkInput({ value, onChange, placeholder, max = 10 }: Props) {
  const lines = value.split('\n').filter((l) => l.trim().length > 0);
  const overLimit = lines.length > max;
  return (
    <div className="space-y-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={placeholder ?? `One entry per line, max ${max}`}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 font-mono text-sm text-zinc-100 focus:border-zinc-400 focus:outline-none"
      />
      <div className={`text-xs ${overLimit ? 'text-red-400' : 'text-zinc-400'}`}>
        {lines.length} / {max}
        {overLimit && ' — extra entries will be ignored'}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `ScreenshotActions`**

Create `src/components/shared/ScreenshotActions.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface Props {
  imageDataUri: string;
  filename: string;
  onOpenFull: () => void;
}

async function copyImage(dataUri: string): Promise<void> {
  const res = await fetch(dataUri);
  const blob = await res.blob();
  if (!navigator.clipboard || !('write' in navigator.clipboard)) {
    throw new Error('Clipboard API not supported');
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

export function ScreenshotActions({ imageDataUri, filename, onOpenFull }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');

  return (
    <div className="flex gap-2 text-xs">
      <a
        href={imageDataUri}
        download={filename}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 hover:bg-zinc-800"
      >
        Download
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await copyImage(imageDataUri);
            setCopyState('ok');
            setTimeout(() => setCopyState('idle'), 1500);
          } catch {
            setCopyState('err');
            setTimeout(() => setCopyState('idle'), 1500);
          }
        }}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 hover:bg-zinc-800"
      >
        {copyState === 'ok' ? 'Copied!' : copyState === 'err' ? 'Copy unsupported' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={onOpenFull}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 hover:bg-zinc-800"
      >
        View full-size
      </button>
    </div>
  );
}
```

- [ ] **Step 5: `DownloadZipButton`**

Create `src/components/shared/DownloadZipButton.tsx`:

```tsx
'use client';

import JSZip from 'jszip';

interface Item {
  filename: string;
  imageDataUri: string;
}

interface Props {
  items: Item[];
  zipName: string;
}

async function dataUriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  return res.blob();
}

export function DownloadZipButton({ items, zipName }: Props) {
  async function handleClick() {
    const zip = new JSZip();
    for (const it of items) {
      const blob = await dataUriToBlob(it.imageDataUri);
      zip.file(it.filename, blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  if (items.length === 0) return null;
  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-800"
    >
      Download all as ZIP ({items.length})
    </button>
  );
}
```

- [ ] **Step 6: `RecentCaptures`**

Create `src/components/shared/RecentCaptures.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface HistoryItem {
  id: string;
  tool: string;
  query: string;
  language?: 'en' | 'tc';
  timestamp: number;
  url: string;
}

interface Props {
  tool: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
  refreshKey: number; // bump to force re-fetch after a new capture
}

export function RecentCaptures({ tool, refreshKey }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    fetch(`/api/history?tool=${tool}&limit=5`)
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => setItems([]));
  }, [tool, refreshKey]);

  if (items.length === 0) return null;
  return (
    <section className="mt-6 border-t border-zinc-800 pt-4">
      <h3 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Recent captures (last 24 h)</h3>
      <ul className="space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 text-zinc-300">
            <span className="truncate font-mono text-zinc-100">
              {it.query}
              {it.language ? ` (${it.language})` : ''}
            </span>
            <span className="shrink-0 text-xs text-zinc-500">
              {new Date(it.timestamp).toLocaleTimeString()}
            </span>
            <a
              href={it.url}
              download={`${it.tool}_${it.query}.png`}
              className="shrink-0 text-xs text-sky-400 hover:text-sky-300"
            >
              re-download
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 7: Verify type-check + lint pass**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/
git commit -m "feat(ui): shared components for language, bulk, actions, ZIP, recent

LanguageToggle (EN|中文 pill), BulkInput (multiline textarea with count),
ScreenshotActions (Download/Copy/View with copy fallback state),
DownloadZipButton (JSZip wrapper), RecentCaptures (24h history strip with
re-download links). ui-ux-pro-max guidance applied.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 14: Refactor HKEX panel

**Files:**
- Modify: `src/components/panels/HkexPanel.tsx` (confirm path; the current tree has both `src/components/HkexPanel.tsx` and `src/components/panels/` — use whichever is wired into `ToolWorkspace`)

- [ ] **Step 1: Locate the live HKEX panel**

Run:
```bash
grep -rn "HkexPanel" src/components/layout/ToolWorkspace.tsx
```

Use the path reported there. If both copies exist, keep the one wired in and delete the other in this commit.

- [ ] **Step 2: Replace panel contents**

Replace the panel's contents with:

```tsx
'use client';

import { useCallback, useState } from 'react';
import { RecentCaptures } from '@/components/shared/RecentCaptures';
import { ScreenshotActions } from '@/components/shared/ScreenshotActions';

interface CaptureResult {
  id: string;
  query: string;
  image: string;
  timestamp: number;
}

export default function HkexPanel() {
  const [stockCode, setStockCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const capture = useCallback(async () => {
    if (!stockCode.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/capture/hkex', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stockCode: stockCode.trim() }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? 'Capture failed');
      } else {
        setResults((prev) => [...body.results, ...prev]);
        setRefresh((n) => n + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [stockCode, loading]);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">HKEX — Equities Capture</h2>
      <div className="flex gap-2">
        <input
          value={stockCode}
          onChange={(e) => setStockCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && capture()}
          placeholder="e.g. 0005"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-zinc-400 focus:outline-none"
          aria-label="Stock code"
        />
        <button
          type="button"
          onClick={capture}
          disabled={!stockCode.trim() || loading}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Capturing…' : 'Capture'}
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950 p-3 text-sm text-red-200">
          <div>{error}</div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={capture} className="underline">
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(error ?? '')}
              className="underline"
            >
              Copy error details
            </button>
          </div>
        </div>
      )}
      {loading && <div className="text-sm text-zinc-400">Capturing HKEX {stockCode}…</div>}
      <div className="grid grid-cols-2 gap-4">
        {results.map((r) => (
          <figure key={r.id} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
            <img
              src={r.image}
              alt={`HKEX ${r.query}`}
              className="h-auto w-full rounded cursor-pointer"
              onClick={() => setFullImage(r.image)}
            />
            <figcaption className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {r.query} · {new Date(r.timestamp).toLocaleTimeString()}
              </span>
              <ScreenshotActions
                imageDataUri={r.image}
                filename={`hkex_${r.query}_${new Date(r.timestamp).toISOString().slice(0, 10)}.png`}
                onOpenFull={() => setFullImage(r.image)}
              />
            </figcaption>
          </figure>
        ))}
      </div>
      {fullImage && (
        <div
          onClick={() => setFullImage(null)}
          onKeyDown={(e) => e.key === 'Escape' && setFullImage(null)}
          role="dialog"
          aria-modal
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={fullImage} alt="Full-size capture" className="max-h-full max-w-full" />
        </div>
      )}
      <RecentCaptures tool="hkex" refreshKey={refresh} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build + dev smoke**

Run: `npm run build`
Expected: passes.

Start dev server (same env as Task 10 Step 7). In the browser, enter `0005`, click Capture. After ~15-25 s an HKEX screenshot appears. Download, Copy, View full-size, and re-capture all work. Recent captures strip lists the result.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat(ui): HKEX panel uses Route Handler API + new shared components

Migrates HKEX panel from Server Action import to fetch('/api/capture/hkex').
Adds Download/Copy/View per thumbnail, Escape-to-close full-size modal,
and Recent captures strip.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 15: Refactor SFC panel (language + bulk)

**Files:**
- Modify: the live SFC panel (locate with grep, same as Task 14 Step 1)

- [ ] **Step 1: Replace panel contents**

Replace the SFC panel's contents with:

```tsx
'use client';

import { useCallback, useState } from 'react';
import { BulkInput } from '@/components/shared/BulkInput';
import { DownloadZipButton } from '@/components/shared/DownloadZipButton';
import { LanguageToggle } from '@/components/shared/LanguageToggle';
import { RecentCaptures } from '@/components/shared/RecentCaptures';
import { ScreenshotActions } from '@/components/shared/ScreenshotActions';

interface CaptureResult {
  id: string;
  query: string;
  image: string;
  timestamp: number;
}

export default function SfcPanel() {
  const [raw, setRaw] = useState('');
  const [language, setLanguage] = useState<'en' | 'tc'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const capture = useCallback(async () => {
    const fundNames = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (fundNames.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/capture/sfc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fundNames, language }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error ?? 'Capture failed');
      } else {
        setResults((prev) => [...body.results, ...prev]);
        setRefresh((n) => n + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [raw, language, loading]);

  const zipItems = results.map((r) => ({
    imageDataUri: r.image,
    filename: `sfc_${r.query.replace(/\s+/g, '_')}_${language}.png`,
  }));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">SFC — CIES Fund List</h2>
        <LanguageToggle value={language} onChange={setLanguage} />
      </div>
      <BulkInput value={raw} onChange={setRaw} placeholder="One fund name per line, max 10" />
      <button
        type="button"
        onClick={capture}
        disabled={loading || raw.trim().length === 0}
        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Capturing…' : 'Capture'}
      </button>
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950 p-3 text-sm text-red-200">{error}</div>
      )}
      {loading && <div className="text-sm text-zinc-400">Capturing {language.toUpperCase()} SFC rows…</div>}
      {results.length > 0 && <DownloadZipButton items={zipItems} zipName={`sfc_${language}.zip`} />}
      <div className="grid grid-cols-1 gap-4">
        {results.map((r) => (
          <figure key={r.id} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
            <img
              src={r.image}
              alt={`SFC ${r.query}`}
              className="h-auto w-full rounded cursor-pointer"
              onClick={() => setFullImage(r.image)}
            />
            <figcaption className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {r.query} · {language.toUpperCase()} · {new Date(r.timestamp).toLocaleTimeString()}
              </span>
              <ScreenshotActions
                imageDataUri={r.image}
                filename={`sfc_${r.query.replace(/\s+/g, '_')}_${language}.png`}
                onOpenFull={() => setFullImage(r.image)}
              />
            </figcaption>
          </figure>
        ))}
      </div>
      {fullImage && (
        <div
          onClick={() => setFullImage(null)}
          onKeyDown={(e) => e.key === 'Escape' && setFullImage(null)}
          role="dialog"
          aria-modal
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={fullImage} alt="Full-size capture" className="max-h-full max-w-full" />
        </div>
      )}
      <RecentCaptures tool="sfc" refreshKey={refresh} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build + dev smoke**

Run: `npm run build`
Expected: passes.

In the dev server, paste 2 fund names on separate lines, pick 中文, click Capture. Wait ~40-60 s. Both rows appear, Download ZIP produces a zip with both PNGs, Recent captures shows them.

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat(ui): SFC panel with EN/中文 toggle + bulk + ZIP

One-click language switch navigates directly to /en/ or /tc/ SFC URL.
Multiline input captures up to 10 funds per submit. JSZip wires up the
Download all as ZIP button.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 16: Refactor AFRC Individual panel (bulk)

**Files:**
- Modify: the live AFRC Individual panel

- [ ] **Step 1: Replace panel contents**

Mirror the SFC panel pattern without the language toggle. Single searchType radio (name vs regNo), BulkInput for values, fetch `/api/capture/afrc` for each trimmed value sequentially *on the client* (backend route handles one at a time; client loops so failures are per-item). Keep recent-captures strip tied to `afrc`.

Concrete code (replace panel contents):

```tsx
'use client';

import { useCallback, useState } from 'react';
import { BulkInput } from '@/components/shared/BulkInput';
import { DownloadZipButton } from '@/components/shared/DownloadZipButton';
import { RecentCaptures } from '@/components/shared/RecentCaptures';
import { ScreenshotActions } from '@/components/shared/ScreenshotActions';

interface CaptureResult {
  id: string;
  query: string;
  image: string;
  timestamp: number;
}

export default function AfrcPanel() {
  const [raw, setRaw] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'regNo'>('name');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const capture = useCallback(async () => {
    const values = raw.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (values.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: values.length });
    const collected: CaptureResult[] = [];
    const failures: string[] = [];
    for (let i = 0; i < values.length; i++) {
      try {
        const res = await fetch('/api/capture/afrc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ searchType, searchValue: values[i] }),
        });
        const body = await res.json();
        if (body.success) collected.push(...body.results);
        else failures.push(`${values[i]}: ${body.error}`);
      } catch (e) {
        failures.push(`${values[i]}: ${(e as Error).message}`);
      }
      setProgress({ done: i + 1, total: values.length });
    }
    setResults((prev) => [...collected, ...prev]);
    if (failures.length > 0) setError(failures.join('\n'));
    setLoading(false);
    setProgress(null);
    setRefresh((n) => n + 1);
  }, [raw, searchType, loading]);

  const zipItems = results.map((r) => ({
    imageDataUri: r.image,
    filename: `afrc_${r.query.replace(/\s+/g, '_')}.png`,
  }));

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">AFRC Individual — CPA Register</h2>
      <div className="flex gap-4 text-sm text-zinc-300">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={searchType === 'name'}
            onChange={() => setSearchType('name')}
          />
          Name
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={searchType === 'regNo'}
            onChange={() => setSearchType('regNo')}
          />
          Practising number
        </label>
      </div>
      <BulkInput value={raw} onChange={setRaw} />
      <button
        type="button"
        onClick={capture}
        disabled={loading || raw.trim().length === 0}
        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Capturing…' : 'Capture'}
      </button>
      {progress && (
        <div className="text-sm text-zinc-400">
          {progress.done} / {progress.total} captured
        </div>
      )}
      {error && (
        <pre className="whitespace-pre-wrap rounded-md border border-red-900 bg-red-950 p-3 text-sm text-red-200">
          {error}
        </pre>
      )}
      {results.length > 0 && <DownloadZipButton items={zipItems} zipName="afrc.zip" />}
      <div className="grid grid-cols-1 gap-4">
        {results.map((r) => (
          <figure key={r.id} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
            <img
              src={r.image}
              alt={`AFRC ${r.query}`}
              className="h-auto w-full rounded cursor-pointer"
              onClick={() => setFullImage(r.image)}
            />
            <figcaption className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {r.query} · {new Date(r.timestamp).toLocaleTimeString()}
              </span>
              <ScreenshotActions
                imageDataUri={r.image}
                filename={`afrc_${r.query.replace(/\s+/g, '_')}.png`}
                onOpenFull={() => setFullImage(r.image)}
              />
            </figcaption>
          </figure>
        ))}
      </div>
      {fullImage && (
        <div
          onClick={() => setFullImage(null)}
          role="dialog"
          aria-modal
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={fullImage} alt="Full-size capture" className="max-h-full max-w-full" />
        </div>
      )}
      <RecentCaptures tool="afrc" refreshKey={refresh} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build + dev smoke**

Run: `npm run build`
Expected: passes.

Dev server smoke: paste one CPA name (e.g. `Chan`), capture. Screenshot arrives. Paste two names, capture — progress counter ticks, both results appear. If one fails (e.g. regulator site slow), only that failure's error shows; other results still land.

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat(ui): AFRC Individual panel with bulk + progress + ZIP

Client loops over inputs for per-item failure isolation. Progress counter
reports X / Y captured while running. JSZip wires up the bulk ZIP download.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 17: Refactor AFRC Firm panel

**Files:**
- Modify: the live AFRC Firm panel

- [ ] **Step 1: Replace panel contents**

```tsx
'use client';

import { useCallback, useState } from 'react';
import { DownloadZipButton } from '@/components/shared/DownloadZipButton';
import { RecentCaptures } from '@/components/shared/RecentCaptures';
import { ScreenshotActions } from '@/components/shared/ScreenshotActions';

interface CaptureResult {
  id: string;
  query: string;
  image: string;
  timestamp: number;
}

export default function AfrcFirmPanel() {
  const [englishName, setEnglishName] = useState('');
  const [chineseName, setChineseName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptureResult[]>([]);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const capture = useCallback(async () => {
    if (loading) return;
    if (!englishName.trim() && !chineseName.trim() && !regNo.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/capture/afrc-firm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          englishName: englishName.trim() || undefined,
          chineseName: chineseName.trim() || undefined,
          regNo: regNo.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) setError(body.error ?? 'Capture failed');
      else {
        setResults((prev) => [...body.results, ...prev]);
        setRefresh((n) => n + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [englishName, chineseName, regNo, loading]);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">AFRC Firm — CPA Firm Register</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={englishName}
          onChange={(e) => setEnglishName(e.target.value)}
          placeholder="English name"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
        <input
          value={chineseName}
          onChange={(e) => setChineseName(e.target.value)}
          placeholder="中文名稱"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
        <input
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
          placeholder="Registration number"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </div>
      <button
        type="button"
        onClick={capture}
        disabled={loading || (!englishName.trim() && !chineseName.trim() && !regNo.trim())}
        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Capturing…' : 'Capture'}
      </button>
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950 p-3 text-sm text-red-200">{error}</div>
      )}
      {results.length > 0 && (
        <DownloadZipButton
          items={results.map((r) => ({
            imageDataUri: r.image,
            filename: `afrc-firm_${r.query.replace(/\s+/g, '_')}.png`,
          }))}
          zipName="afrc-firm.zip"
        />
      )}
      <div className="grid grid-cols-1 gap-4">
        {results.map((r) => (
          <figure key={r.id} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
            <img
              src={r.image}
              alt={`AFRC Firm ${r.query}`}
              className="h-auto w-full rounded cursor-pointer"
              onClick={() => setFullImage(r.image)}
            />
            <figcaption className="mt-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {r.query} · {new Date(r.timestamp).toLocaleTimeString()}
              </span>
              <ScreenshotActions
                imageDataUri={r.image}
                filename={`afrc-firm_${r.query.replace(/\s+/g, '_')}.png`}
                onOpenFull={() => setFullImage(r.image)}
              />
            </figcaption>
          </figure>
        ))}
      </div>
      {fullImage && (
        <div
          onClick={() => setFullImage(null)}
          role="dialog"
          aria-modal
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={fullImage} alt="Full-size capture" className="max-h-full max-w-full" />
        </div>
      )}
      <RecentCaptures tool="afrc-firm" refreshKey={refresh} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build + dev smoke**

Run: `npm run build` → pass.

Dev smoke: type an English firm name (e.g. `KPMG`), capture. Screenshot arrives.

- [ ] **Step 3: Delete dead code**

Now that UI no longer references them:

```bash
rm -rf src/actions
```

Verify build:
```bash
npm run build
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): AFRC Firm panel + delete obsolete actions directory

AFRC Firm panel consumes /api/capture/afrc-firm with three optional inputs
(at least one required). Deletes src/actions/* now that no UI imports from
it — capture logic lives in src/lib/captures/, Route Handlers orchestrate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 18: `/logs` viewer page

**Files:**
- Create: `src/app/logs/page.tsx`

- [ ] **Step 1: Write the logs page**

Create `src/app/logs/page.tsx`:

```tsx
import { readRecentLogs } from '@/lib/capture-log';

export const dynamic = 'force-dynamic';

export default async function LogsPage() {
  const entries = await readRecentLogs(200);
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <h1 className="mb-4 text-lg font-semibold">Capture log — last 200 entries</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Read-only. Copy rows with <code>ok:false</code> and paste them to Claude for diagnosis.
      </p>
      <table className="w-full table-auto text-xs">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 pr-4">Time</th>
            <th className="py-1 pr-4">Tool</th>
            <th className="py-1 pr-4">Query</th>
            <th className="py-1 pr-4">OK</th>
            <th className="py-1 pr-4">ms</th>
            <th className="py-1 pr-4">Stage</th>
            <th className="py-1">Error</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className={`border-t border-zinc-800 ${e.ok ? '' : 'text-red-300'}`}>
              <td className="py-1 pr-4 font-mono">{e.t.replace('T', ' ').slice(0, 19)}</td>
              <td className="py-1 pr-4">{e.tool}</td>
              <td className="py-1 pr-4 font-mono">{e.query}</td>
              <td className="py-1 pr-4">{e.ok ? '✓' : '✗'}</td>
              <td className="py-1 pr-4">{e.ms}</td>
              <td className="py-1 pr-4">{e.stage ?? ''}</td>
              <td className="py-1">{e.err ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Verify + smoke**

Run: `npm run build` → pass.

Open `http://localhost:3000/logs`. Table renders with captures from prior tasks. Failures are red.

- [ ] **Step 3: Commit**

```bash
git add src/app/logs/
git commit -m "feat(ui): /logs read-only viewer for capture log

Renders last 200 JSONL entries as a table. Failures highlighted red.
Copy-paste source of truth for remote diagnosis.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 5 — Deployment artifacts

## Task 19: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Write Dockerfile**

Create `Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/playwright:v1.57.0-jammy-arm64 AS base
WORKDIR /app
ENV NODE_ENV=production

# Install Noto CJK once, at image build time (not per cold start).
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

# Deps
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM deps AS build
COPY . .
RUN npm run build

# Runtime
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts ./
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 2: Write `.dockerignore`**

Create `.dockerignore`:

```
.git
.next
node_modules
docs
scripts/smoke.ts
*.log
.env*
```

- [ ] **Step 3: Verify the image builds locally**

Run:
```bash
docker build -t cies:local .
```

Expected: succeeds. (If on an x86 Mac, pass `--platform linux/arm64`; the VM runs ARM.)

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(docker): production image on Playwright ARM64 base

Uses mcr.microsoft.com/playwright:v1.57.0-jammy-arm64 so Chromium matches
Playwright without @sparticuz/chromium. Noto CJK installed via apt at build
time, no runtime font download.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 20: Deploy script

**Files:**
- Create: `scripts/deploy-oracle.sh`

- [ ] **Step 1: Write the deploy script**

Create `scripts/deploy-oracle.sh` (executable after creation):

```bash
#!/usr/bin/env bash
# Oracle Cloud Always Free ARM VM — one-shot setup for CIES.
# Run as the ubuntu user (not root). Use sudo where needed.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/marcoaiwithfefe-hub/CIES-SaaS.git}"
APP_DIR="${APP_DIR:-/opt/cies}"
DATA_DIR="${DATA_DIR:-/data}"
TUNNEL_NAME="${TUNNEL_NAME:-cies}"

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu jammy stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  sudo usermod -aG docker "$USER"
  echo "==> Docker installed. Log out and back in to pick up the docker group, then re-run."
  exit 0
fi

echo "==> Preparing directories"
sudo mkdir -p "$APP_DIR" "$DATA_DIR/captures" "$DATA_DIR/logs"
sudo chown -R "$USER:$USER" "$APP_DIR" "$DATA_DIR"

echo "==> Cloning repo"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

echo "==> Building image"
cd "$APP_DIR"
docker build -t cies:latest .

echo "==> Writing .env"
RAND_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 40)"
cat > "$APP_DIR/.env" <<EOF
INTERNAL_API_SECRET=${RAND_SECRET}
CIES_DATA_DIR=${DATA_DIR}
NODE_ENV=production
EOF

echo "==> Writing systemd service"
sudo tee /etc/systemd/system/cies.service >/dev/null <<UNIT
[Unit]
Description=CIES Screenshot Tool
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker rm -f cies
ExecStart=/usr/bin/docker run --rm --name cies \\
  -p 127.0.0.1:3000:3000 \\
  -v ${DATA_DIR}:/data \\
  --env-file ${APP_DIR}/.env \\
  cies:latest
ExecStop=/usr/bin/docker stop cies

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now cies.service

echo "==> Installing cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -L -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i /tmp/cloudflared.deb
fi

echo ""
echo "==> Setup done. Next steps (run manually):"
echo "  1) cloudflared tunnel login"
echo "  2) cloudflared tunnel create ${TUNNEL_NAME}"
echo "  3) cloudflared tunnel route dns ${TUNNEL_NAME} <your-hostname>"
echo "     or use 'cloudflared tunnel --url http://127.0.0.1:3000' for a trycloudflare.com URL"
echo "  4) Set CIES_SELF_PING_URL in ${APP_DIR}/.env to the public URL + /api/health, then:"
echo "     sudo systemctl restart cies"
echo ""
echo "==> Tail logs with: journalctl -u cies -f"
```

Make executable:
```bash
chmod +x scripts/deploy-oracle.sh
```

- [ ] **Step 2: Commit**

```bash
git add scripts/deploy-oracle.sh
git commit -m "feat(deploy): one-shot Oracle VM setup script

Installs Docker, builds image, creates systemd service, installs cloudflared,
prints final manual steps (tunnel create + DNS route). Idempotent on re-run.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Task 21: CLAUDE.md rewrite for the new architecture

**Files:**
- Modify: `CLAUDE.md` (significant rewrite — the current content describes the Vercel architecture)

- [ ] **Step 1: Rewrite CLAUDE.md**

Replace the entire contents of `CLAUDE.md` with:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Is This?

**CIES Internal Check — Regulatory Auditor.** Internal compliance tool for the Hong Kong financial market. Runs server-side Playwright captures against four live regulatory sites for ~20 internal users (5 power users). Rebuilt April 2026 to move off Vercel serverless after an architectural-bug treadmill; now runs as a single long-lived Chromium on an Oracle Cloud Always Free ARM VM.

See `docs/superpowers/specs/2026-04-20-cies-rebuild-design.md` for the authoritative design. Section 13 documents accepted risks (no auth, no rate limiting) and their reversal triggers.

---

## Commands

```bash
npm run dev          # Dev server → http://localhost:3000
npm run build
npm run lint
npm run type-check
npx playwright install chromium   # Required once for local dev
```

No test runner. Verification is: type-check + lint + build + live-site smoke.

Local dev env:
```bash
INTERNAL_API_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
CIES_DATA_DIR=/tmp/cies-data \
npm run dev
```

---

## Tech Stack

Next.js 15 · React 19 · Tailwind v4 · Playwright (via `playwright` devDependency locally; `mcr.microsoft.com/playwright:v1.57.0-jammy-arm64` base image in prod) · JSZip · `p-limit` · Zod (input validation).

**Deleted from the Vercel era:** `@sparticuz/chromium`, mock-mode, Gemini env requirement, pkill zombie workaround, runtime font download, `vercel.json`.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── capture/{hkex,sfc,afrc,afrc-firm}/route.ts  # Route Handlers
│   │   ├── history/route.ts
│   │   ├── history/[id]/image/route.ts
│   │   └── health/route.ts
│   ├── logs/page.tsx                                    # Read-only viewer
│   ├── layout.tsx
│   └── page.tsx                                         # Renders ToolWorkspace
├── components/
│   ├── layout/{Sidebar.tsx, ToolWorkspace.tsx}          # Keep-alive switcher
│   ├── panels/{HkexPanel,SfcPanel,AfrcPanel,AfrcFirmPanel}.tsx
│   └── shared/{LanguageToggle,BulkInput,ScreenshotActions,DownloadZipButton,RecentCaptures}.tsx
└── lib/
    ├── browser-singleton.ts     # Long-lived Chromium + watchdog
    ├── semaphore.ts             # p-limit wrapper, cap 12
    ├── capture-store.ts         # /data/captures/<tool>/<YYYY-MM-DD>/<uuid>.png + 24h cleanup
    ├── capture-log.ts           # JSONL → /data/logs/captures.log
    ├── self-ping.ts             # Hourly keep-alive
    ├── run-capture.ts           # Orchestrator: semaphore + context + retry-once + log + store
    ├── playwright-utils.ts      # Stealth context, robustClick, clipScreenshot
    └── captures/{hkex,sfc,afrc,afrc-firm}.ts
```

### Keep-Alive Panel Switching

`ToolWorkspace.tsx` always mounts all 4 panels. Only the active one gets `display:block`. Preserves inputs/results/loading across tab switches. **Do not convert to conditional rendering.**

### Runtime model

One `chromium.launch()` at first-request. Each capture opens a fresh `BrowserContext`. Watchdog respawns on disconnect or every 24 h. Concurrency semaphore (cap 12) queues overflow. Bulk captures (SFC loop, AFRC client-side loop) occupy one slot for the whole batch.

### Retry policy

Navigation failures (`goto`, `net::`, nav timeouts) → silent retry once in `run-capture.ts`. Selector failures → no retry, surface error to user (signals site redesign).

### Screenshot fallback

`clipScreenshot` tries `fullPage:true` first; on Chrome GPU texture-limit error, measures `document.body.scrollHeight` and clips to `min(scrollHeight, 4096)`.

---

## The Four Tools

### HKEX — Equities Capture
- URL: `https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK`
- Search selector: `input[placeholder="代號 / 關鍵字"]` (with fallbacks)
- Output: viewport-only PNG

### SFC — CIES Fund List
- URL: `.../en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES` or `.../tc/...`
- Accordion: `.accordin_expand`
- Row screenshot via `page.locator('tr', { hasText: name })`
- **EN / 中文 toggle:** direct URL swap, no in-page click

### AFRC Individual — CPA Register
- URL: `https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx`
- Selectors: `#vNAME`, `#vREGNO`, `#BTNUA_SEARCH`, `#GridContainerDiv`
- Post-click: `waitForNavigation` + `robustClick` (ASP.NET postback)

### AFRC Firm — CPA Firm Register
- URL: `.../ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx` (**different app** from AFRC Individual)
- Selectors: `#vNAME`, `#vCHINESENAME`, `#vREGNO`
- GeneXus quirk: inputs hidden during init — use `waitFor('attached')` + `fill({force:true})`

---

## Environment Variables

```env
INTERNAL_API_SECRET=<min 32 chars>        # Required
CIES_DATA_DIR=/data                       # Override for local dev (/tmp/cies-data)
CIES_SELF_PING_URL=https://.../api/health # Production only, prevents Oracle idle reclaim
```

---

## Deployment

Dockerfile builds on Playwright's official ARM64 image. `scripts/deploy-oracle.sh` does one-shot VM setup (Docker, git clone, image build, systemd service, cloudflared install). Manual steps after script: `cloudflared tunnel login/create/route dns`, then set `CIES_SELF_PING_URL` in `.env` and restart.

---

## If you're about to add another serverless-era workaround, stop

The repo's pre-April-2026 history is a bug ledger of workarounds for Vercel serverless constraints (60 s timeout, 2 GB RAM, warm-container zombies, `/tmp` font download, sparticuz version pinning). Those constraints no longer exist in this architecture. If you see a new "browser closed" / "timeout exceeded" / "OOM" class bug, **check the Oracle VM health first** (`/api/health`, `journalctl -u cies`) — do not add `pkill` hacks, texture-fallback patches, or timeout reductions. Recovery is already handled by the watchdog and semaphore.

---

## Known fragilities (genuine, not serverless-related)

- **HKEX Chinese placeholder** `代號 / 關鍵字` breaks if HKEX restyles the search box.
- **SFC accordion class** `.accordin_expand` and row-text filter are fragile to redesign.
- **AFRC control IDs** are stable ASP.NET IDs but must be re-verified if either page is updated. The Firm and Individual sites are separate applications.
- **AFRC Firm GeneXus** occasionally changes visibility timing — the `attached` + `force:true` dance handles current behavior.
- **Chrome GPU texture limit** on tall AFRC results — mitigated by `clipScreenshot` fallback.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md for post-rebuild architecture

Swaps serverless/sparticuz guidance for Oracle VM + browser-singleton
model. Adds 'don't add serverless workarounds' warning to prevent
future Claude instances from re-introducing the treadmill patterns.
Preserves genuine fragilities (HKEX/SFC/AFRC selector risks).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

# Phase 6 — Stage 2 smoke testing

## Task 22: Manual smoke on Oracle VM

**Files:** none (runbook task).

- [ ] **Step 1: Provision Oracle Always Free VM**

In Oracle Cloud Console (ap-tokyo-1): create an Ampere A1 ARM VM (1 OCPU, 6 GB RAM is the free-tier default; 4 OCPU / 24 GB also free if quota allows). Ubuntu 22.04. Copy the public IP.

- [ ] **Step 2: Run the deploy script**

SSH to the VM as `ubuntu`. Clone the repo (or scp it up), then:

```bash
bash scripts/deploy-oracle.sh
# log out/in after Docker is first installed, re-run
```

Follow the printed manual steps for `cloudflared`:
```bash
cloudflared tunnel login
cloudflared tunnel create cies
cloudflared tunnel route dns cies <your-hostname>  # or use --url for a trycloudflare.com URL
```

Set `CIES_SELF_PING_URL` in `/opt/cies/.env` to `https://<your-hostname>/api/health`, then:
```bash
sudo systemctl restart cies
```

- [ ] **Step 3: First-touch smoke**

Open the public URL in a browser. Confirm:
- Home page loads with 4 tabs.
- `/api/health` returns `{"ok":true,"chromium":"connected",...}` (first hit triggers Chromium launch — wait ~5 s).
- HKEX capture of `0005` succeeds.
- SFC capture of `BlackRock` in both EN and 中文 succeeds.
- AFRC Individual capture of `Chan` succeeds (or fails cleanly if AFRC is slow — retry confirms retry-once works).
- AFRC Firm capture of `KPMG` succeeds.
- Bulk SFC of 3 fund names succeeds, ZIP download works.
- Copy-to-clipboard works in Chrome.
- `/logs` renders with all captures.

- [ ] **Step 4: Two-day private test**

Marco + one colleague use the URL for their normal workflow over 2–3 days. Each day:

```bash
ssh ubuntu@<vm-ip> tail -50 /data/logs/captures.log
grep '"ok":false' /data/logs/captures.log | wc -l
```

Expected: failures only when target sites are actually slow/down — no browser/runtime failures. If browser failures appear, investigate `journalctl -u cies` and Chromium memory use (`docker stats cies`).

- [ ] **Step 5: Cutover**

Announce new URL to team. Keep Vercel deployment running for 1 week as fallback. After 1 week clean on the VM, decommission Vercel.

- [ ] **Step 6: Commit the runbook outcomes**

If stage 2 revealed any fixes, ship them as separate commits referencing this task. Otherwise:

```bash
git commit --allow-empty -m "chore: complete CIES rebuild, production cutover

Stage 2 smoke test passed on Oracle VM. Vercel deployment retained for
1 week as fallback per spec §8.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Spec coverage check

| Spec section | Tasks that implement it |
|---|---|
| §4 Deployment & Runtime — Infra | 19, 20, 22 |
| §4 Container — Playwright image + CJK apt | 19 |
| §4 Runtime model — singleton + semaphore + watchdog | 2, 3, 10 |
| §5 Frontend — keep-alive, parallel captures, error card, retry | 14–17 |
| §5 SFC EN/中文 toggle | 13, 15 |
| §5 Bulk capture + ZIP | 13, 15, 16, 17 |
| §5 Recent captures strip | 13, 14–17 |
| §5 Copy-to-clipboard | 13 |
| §5 UX principles | 13, 14–17 (ui-ux-pro-max invoked) |
| §6 Route Handlers for all 4 tools | 10 |
| §6 History + health endpoints | 11 |
| §6 Disk storage + 15-min cleanup | 4, 10 |
| §7 Retry-once on navigation fail | 10 |
| §7 JSONL log + `/logs` page | 5, 10, 18 |
| §7 Watchdog on 30 s tick + 24 h forced recycle | 3 |
| §8 Deployment script | 20 |
| §8 Self-ping keep-alive | 12 |
| §8 Stage-2 smoke testing | 22 |
| §11 Strip Vercel vestiges | 1 |
| §11 Delete mock-mode + Gemini requirement | 1 |
| §11 Preserve selector logic | 6–9 |

No gaps identified.
