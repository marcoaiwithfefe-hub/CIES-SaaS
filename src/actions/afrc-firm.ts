'use server';

import { z } from 'zod';
import type { CaptureResult } from './hkex';

const afrcFirmInputSchema = z.object({
  searchType: z.enum(['enName', 'chName', 'regNo']),
  searchValue: z.string().min(1, 'Search value required').max(200, 'Too long'),
});

export type AfrcFirmActionInput = z.infer<typeof afrcFirmInputSchema>;

export interface AfrcFirmActionResult {
  success: true;
  result: CaptureResult;
}
export interface AfrcFirmActionError {
  success: false;
  error: string;
  errorType?: string;
}

export async function captureAfrcFirm(
  rawInput: AfrcFirmActionInput
): Promise<AfrcFirmActionResult | AfrcFirmActionError> {
  const parsed = afrcFirmInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }
  return {
    success: false,
    error: 'Server Action disabled during rebuild — use /api/capture/afrc-firm once Phase 3 ships.',
    errorType: 'REBUILD_IN_PROGRESS',
  };
}
