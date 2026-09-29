import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { LANGUAGE_CODES } from '@/lib/types';

type Params = { params: Promise<{ id: string; lang: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, lang } = await params;
  if (!LANGUAGE_CODES.includes(lang as never)) {
    return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
  }
  try {
    const [row] = await sql`
      SELECT * FROM artwork_translations WHERE artwork_id = ${id} AND language_code = ${lang}
    `;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch translation' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, lang } = await params;
  if (!LANGUAGE_CODES.includes(lang as never)) {
    return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { title, description, purchase_url, is_reviewed } = body;

    const [row] = await sql`
      UPDATE artwork_translations SET
        title        = COALESCE(${title ?? null}, title),
        description  = ${description !== undefined ? description : sql`description`},
        purchase_url = ${purchase_url !== undefined ? purchase_url : sql`purchase_url`},
        is_reviewed  = COALESCE(${is_reviewed ?? null}, is_reviewed),
        updated_at   = now()
      WHERE artwork_id = ${id} AND language_code = ${lang}
      RETURNING *
    `;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update translation' }, { status: 500 });
  }
}
