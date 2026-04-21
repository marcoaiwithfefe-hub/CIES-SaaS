import type { BrowserContext } from 'playwright-core';
import { getBrowser, startWatchdog } from '@/lib/browser-singleton';
import { createStealthContext } from '@/lib/playwright-utils';
import { withCaptureSlot } from '@/lib/semaphore';
import { storeCapture, startCleanupTimer, type Tool, type StoredCaptureMeta } from '@/lib/capture-store';
import { logCapture } from '@/lib/capture-log';

export interface CaptureResult {
  id: string;
  query: string;
  image: string;
  timestamp: number;
}

export interface OrchestrateOptions<I> {
  tool: Tool;
  query: string;
  language?: 'en' | 'tc';
  input: I;
  run: (ctx: BrowserContext, input: I) => Promise<Buffer>;
}

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
