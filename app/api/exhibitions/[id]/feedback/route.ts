import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const { rating, comment, language_code } = await req.json();
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }
    const [row] = await sql`
      INSERT INTO exhibition_feedback (exhibition_id, rating, comment, language_code)
      VALUES (${id}, ${rating}, ${comment ?? null}, ${language_code ?? 'zh-TW'})
      RETURNING *
    `;
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const rows = await sql`
      SELECT * FROM exhibition_feedback
      WHERE exhibition_id = ${id}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
