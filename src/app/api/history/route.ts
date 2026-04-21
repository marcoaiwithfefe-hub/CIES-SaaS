import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listHistory, type Tool } from '@/lib/capture-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  tool: z.enum(['hkex', 'sfc', 'afrc', 'afrc-firm']),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(', ') },
      { status: 400 },
    );
  }
  const items = await listHistory(parsed.data.tool as Tool, parsed.data.limit);
  const withUrls = items.map((m) => ({
    id: m.id,
    tool: m.tool,
    query: m.query,
    language: m.language,
    timestamp: m.timestamp,
    url: `/api/history/${m.id}/image`,
  }));
  return NextResponse.json({ items: withUrls });
}
