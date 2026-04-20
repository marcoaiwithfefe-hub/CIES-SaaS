'use server';

import { z } from 'zod';

// ── Zod input validation ──────────────────────────────────────────────────────
const hkexInputSchema = z.object({
  stockCode: z
    .string()
    .min(1, 'Stock code is required')
    .max(20, 'Stock code too long')
    .regex(/^[0-9A-Za-z.\-]+$/, 'Invalid stock code format'),
});

export type HkexActionInput = z.infer<typeof hkexInputSchema>;

export interface CaptureResult {
  query: string;
  images: string[];    // data:image/png;base64,… strings ready for <img src>
  totalMatches: number;
  timestamp: number;
}

export interface HkexActionResult {
  success: true;
  result: CaptureResult;
}

export interface HkexActionError {
  success: false;
  error: string;
  errorType?: string;
}

// ── Server Action ─────────────────────────────────────────────────────────────
export async function captureHkex(
  rawInput: HkexActionInput
): Promise<HkexActionResult | HkexActionError> {
  const parsed = hkexInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? 'Invalid input',
    };
  }
  return {
    success: false,
    error: 'Server Action disabled during rebuild — use /api/capture/hkex once Phase 3 ships.',
    errorType: 'REBUILD_IN_PROGRESS',
  };
}
