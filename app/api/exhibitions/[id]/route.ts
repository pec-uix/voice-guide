import { auth } from '@/auth';
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { code, name, name_en, description, description_en, review_url, cover_image_url, mobile_cover_image_url } = body;

    const [existing] = await sql`SELECT id FROM exhibitions WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [row] = await sql`
      UPDATE exhibitions SET
        code                   = COALESCE(${code ?? null}, code),
        name                   = COALESCE(${name ?? null}, name),
        name_en                = ${name_en !== undefined ? name_en : sql`name_en`},
        description            = ${description !== undefined ? description : sql`description`},
        description_en         = ${description_en !== undefined ? description_en : sql`description_en`},
        review_url             = ${review_url !== undefined ? review_url : sql`review_url`},
        cover_image_url        = ${cover_image_url !== undefined ? cover_image_url : sql`cover_image_url`},
        mobile_cover_image_url = ${mobile_cover_image_url !== undefined ? mobile_cover_image_url : sql`mobile_cover_image_url`}
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
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const [existing] = await sql`SELECT id FROM exhibitions WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 取得該展覽底下所有作品 id，連帶刪除作品及相關資料
    const artworks = await sql`SELECT id FROM artworks WHERE exhibition_id = ${id}`;
    for (const artwork of artworks) {
      await sql`DELETE FROM transcript_segment_texts WHERE segment_id IN (SELECT id FROM transcript_segments WHERE artwork_id = ${artwork.id})`;
      await sql`DELETE FROM transcript_segments WHERE artwork_id = ${artwork.id}`;
      await sql`DELETE FROM artwork_translations WHERE artwork_id = ${artwork.id}`;
      await sql`DELETE FROM events WHERE artwork_id = ${artwork.id}`;
    }
    await sql`DELETE FROM artworks WHERE exhibition_id = ${id}`;
    await sql`DELETE FROM events WHERE exhibition_id = ${id}`;
    await sql`DELETE FROM exhibition_feedback WHERE exhibition_id = ${id}`;
    await sql`DELETE FROM exhibitions WHERE id = ${id}`;
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error('[DELETE exhibition]', err);
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 });
  }
}
