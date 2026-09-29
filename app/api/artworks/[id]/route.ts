import { sql } from '@/lib/db';
import { translateBoth } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const [artwork] = await sql`SELECT * FROM artworks WHERE id = ${id}`;
    if (!artwork) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const translations = await sql`
      SELECT * FROM artwork_translations WHERE artwork_id = ${id} ORDER BY language_code
    `;
    const segments = await sql`
      SELECT s.*, json_agg(
        json_build_object('id', t.id, 'language_code', t.language_code, 'text', t.text, 'is_reviewed', t.is_reviewed)
        ORDER BY t.language_code
      ) AS texts
      FROM transcript_segments s
      LEFT JOIN transcript_segment_texts t ON t.segment_id = s.id
      WHERE s.artwork_id = ${id}
      GROUP BY s.id
      ORDER BY s.segment_index
    `;
    return NextResponse.json({ data: { ...artwork, translations, segments } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch artwork' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { exhibition_id, code, cover_image_url, artist, year, title, description, purchase_url } =
      body;

    const [existing] = await sql`SELECT id FROM artworks WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [artwork] = await sql`
      UPDATE artworks SET
        exhibition_id   = ${exhibition_id !== undefined ? exhibition_id : sql`exhibition_id`},
        code            = COALESCE(${code ?? null}, code),
        cover_image_url = ${cover_image_url !== undefined ? cover_image_url : sql`cover_image_url`},
        artist          = ${artist !== undefined ? artist : sql`artist`},
        year            = ${year !== undefined ? year : sql`year`},
        updated_at      = now()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update zh-TW translation if title/description/purchase_url provided
    let zhTranslation = null;
    if (title !== undefined || description !== undefined || purchase_url !== undefined) {
      [zhTranslation] = await sql`
        INSERT INTO artwork_translations
          (artwork_id, language_code, title, description, purchase_url, is_reviewed)
        VALUES (
          ${id}, 'zh-TW',
          ${title ?? ''},
          ${description ?? null},
          ${purchase_url ?? null},
          true
        )
        ON CONFLICT (artwork_id, language_code) DO UPDATE SET
          title       = COALESCE(NULLIF(EXCLUDED.title, ''), artwork_translations.title),
          description = CASE WHEN ${description !== undefined} THEN EXCLUDED.description ELSE artwork_translations.description END,
          purchase_url = CASE WHEN ${purchase_url !== undefined} THEN EXCLUDED.purchase_url ELSE artwork_translations.purchase_url END,
          is_reviewed = true,
          updated_at  = now()
        RETURNING *
      `;

      // Re-translate if Chinese content changed
      const zhTitle = zhTranslation?.title ?? title;
      const zhDesc = zhTranslation?.description ?? description;

      if (zhTitle) {
        const [titleT, descT] = await Promise.all([
          translateBoth(zhTitle),
          zhDesc ? translateBoth(zhDesc) : Promise.resolve({ en: null, ja: null }),
        ]);

        for (const lang of ['en', 'ja'] as const) {
          const t = lang === 'en' ? titleT.en : titleT.ja;
          const d = lang === 'en' ? descT.en : descT.ja;
          if (!t) continue;
          await sql`
            INSERT INTO artwork_translations
              (artwork_id, language_code, title, description, purchase_url, is_reviewed)
            VALUES (${id}, ${lang}, ${t}, ${d ?? null}, ${purchase_url ?? null}, false)
            ON CONFLICT (artwork_id, language_code) DO UPDATE SET
              title = EXCLUDED.title, description = EXCLUDED.description,
              is_reviewed = false, updated_at = now()
          `;
        }
      }
    }

    return NextResponse.json({ data: { ...artwork, zh_translation: zhTranslation } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') && msg.includes('code')) {
      return NextResponse.json({ error: 'Artwork code already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to update artwork' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const [existing] = await sql`SELECT id FROM artworks WHERE id = ${id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await sql`DELETE FROM artworks WHERE id = ${id}`;
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete artwork' }, { status: 500 });
  }
}
