import { NextRequest } from 'next/server';
import { readImage } from '@/lib/capture-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = await readImage(id);
  if (!record) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(record.data as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
