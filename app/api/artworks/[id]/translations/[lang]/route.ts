import { auth } from '@/auth';
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, lang } = await params;
  if (!LANGUAGE_CODES.includes(lang as never)) {
    return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { title, description, purchase_url, audio_url, is_reviewed } = body;

    const [row] = await sql`
      INSERT INTO artwork_translations (artwork_id, language_code, title, description, purchase_url, audio_url, is_reviewed)
      VALUES (${id}, ${lang}, ${title ?? ''}, ${description ?? null}, ${purchase_url ?? null}, ${audio_url ?? null}, ${is_reviewed ?? false})
      ON CONFLICT (artwork_id, language_code) DO UPDATE SET
        title        = COALESCE(${title ?? null}, artwork_translations.title),
        description  = ${description !== undefined ? description : sql`artwork_translations.description`},
        purchase_url = ${purchase_url !== undefined ? purchase_url : sql`artwork_translations.purchase_url`},
        audio_url    = ${audio_url !== undefined ? audio_url : sql`artwork_translations.audio_url`},
        is_reviewed  = COALESCE(${is_reviewed ?? null}, artwork_translations.is_reviewed),
        updated_at   = now()
      RETURNING *
    `;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update translation' }, { status: 500 });
  }
}
