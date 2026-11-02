import { requireAdmin } from '@/lib/verify-auth';
import { db } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { rating, comment, language_code } = await req.json();
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }
    const ref = db.collection('exhibition_feedback').doc();
    const row = {
      id: ref.id,
      exhibition_id: id,
      rating,
      comment: comment ?? null,
      language_code: language_code ?? 'zh-TW',
      created_at: new Date().toISOString(),
    };
    await ref.set(row);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const snap = await db.collection('exhibition_feedback').where('exhibition_id', '==', id).get();
    const rows = snap.docs
      .sort((a, b) => ((b.data().created_at as string) ?? '').localeCompare((a.data().created_at as string) ?? ''))
      .map(d => d.data());
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
