import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureAfrc } from '@/lib/captures/afrc';
import { orchestrateCapture } from '@/lib/run-capture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  searchType: z.enum(['name', 'regNo']),
  searchValue: z.string().min(1).max(100),
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
    tool: 'afrc',
    query: parsed.data.searchValue,
    input: parsed.data,
    run: async (ctx, input) => {
      const page = await ctx.newPage();
      return captureAfrc(page, input);
    },
  });
  if (result.success) return NextResponse.json({ success: true, results: [result.result] });
  return NextResponse.json(result, { status: 500 });
}
