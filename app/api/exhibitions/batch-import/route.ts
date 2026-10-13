import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

interface ArtworkInput {
  productId?: number;
  title: string;
  artist?: string;
  year?: string;
  description?: string;
  imageUrl?: string;
  purchaseUrl?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { code, name, description, artworks } = body as {
    code: string;
    name: string;
    description?: string;
    artworks?: ArtworkInput[];
  };

  if (!code?.trim()) return NextResponse.json({ error: '展覽代碼為必填' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: '展覽名稱為必填' }, { status: 400 });

  try {
    const [exhibition] = await sql`
      INSERT INTO exhibitions (code, name, description)
      VALUES (${code.trim()}, ${name.trim()}, ${description ?? null})
      RETURNING *
    `;

    let created = 0;
    for (const aw of artworks ?? []) {
      if (!aw.title?.trim()) continue;
      const artworkCode = `${code.trim()}-${aw.productId ?? created + 1}`;
      try {
        const [artwork] = await sql`
          INSERT INTO artworks (exhibition_id, code, cover_image_url, artist, year)
          VALUES (${exhibition.id}, ${artworkCode}, ${aw.imageUrl ?? null}, ${aw.artist ?? null}, ${aw.year ?? null})
          RETURNING *
        `;
        await sql`
          INSERT INTO artwork_translations
            (artwork_id, language_code, title, description, purchase_url, is_reviewed)
          VALUES
            (${artwork.id}, 'zh-TW', ${aw.title.trim()}, ${aw.description ?? null}, ${aw.purchaseUrl ?? null}, true)
        `;
        created++;
      } catch (err) {
        console.error('Failed to create artwork:', aw.title, err);
      }
    }

    return NextResponse.json(
      { data: { exhibition, artworksCreated: created } },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') && msg.includes('code')) {
      return NextResponse.json({ error: '展覽代碼已存在，請換一個' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: '建立失敗' }, { status: 500 });
  }
}
