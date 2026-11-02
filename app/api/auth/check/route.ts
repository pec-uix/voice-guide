import { requireAdmin } from '@/lib/verify-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
