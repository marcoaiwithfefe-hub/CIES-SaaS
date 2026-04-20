import pLimit, { LimitFunction } from 'p-limit';

export const MAX_CONCURRENT_CAPTURES = 12;

const limiter: LimitFunction = pLimit(MAX_CONCURRENT_CAPTURES);

export function withCaptureSlot<T>(fn: () => Promise<T>): Promise<T> {
  return limiter(fn);
}

export function getQueueStats(): { active: number; pending: number } {
  return { active: limiter.activeCount, pending: limiter.pendingCount };
}
