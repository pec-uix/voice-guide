import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { translateBoth } from '@/lib/gemini';

interface ArtworkInput {
  productId?: number;
  title: string;
  title_en?: string | null;
  artist?: string;
  year?: string;
  description?: string;
  imageUrl?: string;
  purchaseUrl?: string;
  purchaseUrlEn?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { code, name, description, cover_image_url, mobile_cover_image_url, artworks } = body as {
    code: string;
    name: string;
    description?: string;
    cover_image_url?: string;
    mobile_cover_image_url?: string;
    artworks?: ArtworkInput[];
  };

  if (!code?.trim()) return NextResponse.json({ error: '展覽代碼為必填' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: '展覽名稱為必填' }, { status: 400 });

  try {
    const [exhibition] = await sql`
      INSERT INTO exhibitions (code, name, description, cover_image_url, mobile_cover_image_url)
      VALUES (${code.trim()}, ${name.trim()}, ${description ?? null}, ${cover_image_url ?? null}, ${mobile_cover_image_url ?? null})
      RETURNING *
    `;

    // Pre-translate all artwork titles and descriptions in parallel
    const validArtworks = (artworks ?? []).filter(aw => aw.title?.trim());
    const translations = await Promise.all(
      validArtworks.map(async aw => {
        // Use real English title if provided (from uniart EN page), else translate
        const enTitle = aw.title_en?.trim() || (await translateBoth(aw.title)).en;
        const enDescription = aw.description ? (await translateBoth(aw.description)).en : null;
        const titleFromSite = !!(aw.title_en?.trim());
        return { enTitle, enDescription, titleFromSite };
      })
    );

    let created = 0;
    for (let i = 0; i < validArtworks.length; i++) {
      const aw = validArtworks[i];
      const { enTitle, enDescription, titleFromSite } = translations[i];
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

        if (enTitle) {
          // Use explicit EN URL if provided, otherwise derive from ZH uniart URL
          const enPurchaseUrl = aw.purchaseUrlEn
            ?? aw.purchaseUrl?.replace('uniart.com.tw/products/', 'uniart.com.tw/en/products/')
            ?? null;
          await sql`
            INSERT INTO artwork_translations
              (artwork_id, language_code, title, description, purchase_url, is_reviewed)
            VALUES
              (${artwork.id}, 'en', ${enTitle}, ${enDescription ?? null}, ${enPurchaseUrl}, ${titleFromSite})
          `;
        }

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
