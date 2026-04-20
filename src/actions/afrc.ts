'use server';

import { z } from 'zod';
import type { CaptureResult } from './hkex';

const afrcInputSchema = z.object({
  searchType: z.enum(['name', 'regNo']),
  searchValue: z.string().min(1, 'Search value required').max(100, 'Too long'),
});

export type AfrcActionInput = z.infer<typeof afrcInputSchema>;

export interface AfrcActionResult {
  success: true;
  result: CaptureResult;
}
export interface AfrcActionError {
  success: false;
  error: string;
  errorType?: string;
}

export async function captureAfrc(
  rawInput: AfrcActionInput
): Promise<AfrcActionResult | AfrcActionError> {
  const parsed = afrcInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }
  return {
    success: false,
    error: 'Server Action disabled during rebuild — use /api/capture/afrc once Phase 3 ships.',
    errorType: 'REBUILD_IN_PROGRESS',
  };
}
