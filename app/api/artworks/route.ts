import { sql } from '@/lib/db';
import { translateBoth } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exhibitionId = searchParams.get('exhibition_id');

  try {
    const rows = exhibitionId
      ? await sql`
          SELECT a.*, t.title, t.audio_url, t.is_reviewed
          FROM artworks a
          LEFT JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
          WHERE a.exhibition_id = ${exhibitionId}
          ORDER BY a.created_at ASC
        `
      : await sql`
          SELECT a.*, t.title, t.audio_url, t.is_reviewed
          FROM artworks a
          LEFT JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
          ORDER BY a.created_at DESC
        `;
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { exhibition_id, code, cover_image_url, artist, year, title, description, purchase_url } =
      body;

    if (!code?.trim() || !title?.trim()) {
      return NextResponse.json({ error: 'code and title are required' }, { status: 400 });
    }

    // 1. Create artwork
    const [artwork] = await sql`
      INSERT INTO artworks (exhibition_id, code, cover_image_url, artist, year)
      VALUES (
        ${exhibition_id ?? null},
        ${code.trim()},
        ${cover_image_url ?? null},
        ${artist ?? null},
        ${year ?? null}
      )
      RETURNING *
    `;

    // 2. Create zh-TW translation (is_reviewed=true — source language)
    const [zhTranslation] = await sql`
      INSERT INTO artwork_translations
        (artwork_id, language_code, title, description, purchase_url, is_reviewed)
      VALUES
        (${artwork.id}, 'zh-TW', ${title.trim()}, ${description ?? null}, ${purchase_url ?? null}, true)
      RETURNING *
    `;

    // 3. Auto-translate to en/ja (fire-and-forget style — failures don't block save)
    const translations: { en: string | null; ja: string | null }[] = await Promise.all([
      title ? translateBoth(title) : Promise.resolve({ en: null, ja: null }),
      description ? translateBoth(description) : Promise.resolve({ en: null, ja: null }),
    ]);

    const titleT = translations[0];
    const descT = translations[1];

    const insertLang = async (lang: 'en' | 'ja') => {
      const t = lang === 'en' ? titleT.en : titleT.ja;
      const d = lang === 'en' ? descT.en : descT.ja;
      if (!t) return null;
      const [row] = await sql`
        INSERT INTO artwork_translations
          (artwork_id, language_code, title, description, purchase_url, is_reviewed)
        VALUES
          (${artwork.id}, ${lang}, ${t}, ${d ?? null}, ${purchase_url ?? null}, false)
        ON CONFLICT (artwork_id, language_code) DO UPDATE SET
          title = EXCLUDED.title, description = EXCLUDED.description, updated_at = now()
        RETURNING *
      `;
      return row;
    };

    const [enT, jaT] = await Promise.all([insertLang('en'), insertLang('ja')]);

    return NextResponse.json(
      {
        data: {
          ...artwork,
          translations: [
            zhTranslation,
            ...(enT ? [enT] : []),
            ...(jaT ? [jaT] : []),
          ],
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') && msg.includes('code')) {
      return NextResponse.json({ error: 'Artwork code already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to create artwork' }, { status: 500 });
  }
}
