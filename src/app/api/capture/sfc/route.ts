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
  fundNames: z.array(z.string().min(1).max(200).regex(/^[\w一-鿿㐀-䶿\s\-().&,]+$/, 'Invalid fund name')).min(1).max(10),
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
    let ctx: Awaited<ReturnType<typeof createStealthContext>> | undefined;
    try {
      const browser = await getBrowser();
      ctx = await createStealthContext(browser);
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
      await ctx?.close().catch(() => {});
    }
  });
}
