import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureAfrcFirm } from '@/lib/captures/afrc-firm';
import { orchestrateCapture } from '@/lib/run-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z
  .object({
    englishName: z.string().max(200).optional(),
    chineseName: z.string().max(200).optional(),
    regNo: z.string().max(100).optional(),
  })
  .refine(
    (v) => Boolean(v.englishName || v.chineseName || v.regNo),
    { message: 'At least one of englishName, chineseName, or regNo is required' },
  );

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }
  const queryLabel = parsed.data.englishName ?? parsed.data.chineseName ?? parsed.data.regNo!;
  const result = await orchestrateCapture({
    tool: 'afrc-firm',
    query: queryLabel,
    input: parsed.data,
    run: async (ctx, input) => {
      const page = await ctx.newPage();
      return captureAfrcFirm(page, input);
    },
  });
  if (result.success) return NextResponse.json({ success: true, results: [result.result] });
  return NextResponse.json(result, { status: 500 });
}
