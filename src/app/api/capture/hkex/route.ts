import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureHkex } from '@/lib/captures/hkex';
import { orchestrateCapture } from '@/lib/run-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  stockCode: z.string().min(1).max(20).regex(/^[0-9A-Za-z.\-]+$/, 'Invalid stock code format'),
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
