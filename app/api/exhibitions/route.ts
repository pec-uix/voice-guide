import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM exhibitions ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, name, description, review_url } = body;

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO exhibitions (code, name, description, review_url)
      VALUES (${code.trim()}, ${name.trim()}, ${description ?? null}, ${review_url ?? null})
      RETURNING *
    `;
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') && msg.includes('code')) {
      return NextResponse.json({ error: 'Exhibition code already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 });
  }
}
