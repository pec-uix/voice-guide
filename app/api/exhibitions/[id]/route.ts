import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const [exhibition] = await sql`SELECT * FROM exhibitions WHERE id = ${id}`;
    if (!exhibition) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const artworks = await sql`
      SELECT a.*, t.title, t.description AS translation_description, t.audio_url, t.purchase_url
      FROM artworks a
      LEFT JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
      WHERE a.exhibition_id = ${id}
      ORDER BY a.created_at ASC
    `;
    return NextResponse.json({ data: { ...exhibition, artworks } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { code, name, description, review_url } = body;

    const [existing] = await sql`SELECT id FROM exhibitions WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [row] = await sql`
      UPDATE exhibitions SET
        code       = COALESCE(${code ?? null}, code),
        name       = COALESCE(${name ?? null}, name),
        description = ${description !== undefined ? description : sql`description`},
        review_url  = ${review_url !== undefined ? review_url : sql`review_url`}
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json({ data: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') && msg.includes('code')) {
      return NextResponse.json({ error: 'Exhibition code already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to update exhibition' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const [existing] = await sql`SELECT id FROM exhibitions WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await sql`DELETE FROM exhibitions WHERE id = ${id}`;
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 });
  }
}
