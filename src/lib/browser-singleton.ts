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
  const { chromium } = await import('playwright-core');
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
