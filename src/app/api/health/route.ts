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
