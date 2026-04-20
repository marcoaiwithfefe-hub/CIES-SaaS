'use server';

import { z } from 'zod';
import type { CaptureResult } from './hkex';

const sfcInputSchema = z.object({
  fundNames: z
    .array(
      z.string().min(1).max(200).regex(/^[\w\s\-().&,]+$/, 'Invalid fund name')
    )
    .min(1, 'At least one fund name required')
    .max(10, 'Maximum 10 fund names per request'),
});

export type SfcActionInput = z.infer<typeof sfcInputSchema>;

export interface SfcActionResult {
  success: true;
  results: CaptureResult[];
}
export interface SfcActionError {
  success: false;
  error: string;
  errorType?: string;
}

export async function captureSfc(
  rawInput: SfcActionInput
): Promise<SfcActionResult | SfcActionError> {
  const parsed = sfcInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }
  return {
    success: false,
    error: 'Server Action disabled during rebuild — use /api/capture/sfc once Phase 3 ships.',
    errorType: 'REBUILD_IN_PROGRESS',
  };
}
