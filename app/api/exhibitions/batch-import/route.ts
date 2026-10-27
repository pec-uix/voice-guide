import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

interface ArtworkInput {
  productId?: number;
  title: string;
  title_en?: string | null;
  description_en?: string | null;
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
  const { code, name, name_en, description, description_en, cover_image_url, mobile_cover_image_url, artworks } = body as {
    code: string;
    name: string;
    name_en?: string | null;
    description?: string;
    description_en?: string | null;
    cover_image_url?: string;
    mobile_cover_image_url?: string;
    artworks?: ArtworkInput[];
  };

  if (!code?.trim()) return NextResponse.json({ error: '展覽代碼為必填' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: '展覽名稱為必填' }, { status: 400 });

  try {
    const [exhibition] = await sql`
      INSERT INTO exhibitions (code, name, name_en, description, description_en, cover_image_url, mobile_cover_image_url)
      VALUES (${code.trim()}, ${name.trim()}, ${name_en ?? null}, ${description ?? null}, ${description_en ?? null}, ${cover_image_url ?? null}, ${mobile_cover_image_url ?? null})
      RETURNING *
    `;

    const validArtworks = (artworks ?? []).filter(aw => aw.title?.trim());
    if (validArtworks.length === 0) {
      return NextResponse.json({ data: { exhibition, artworksCreated: 0 } }, { status: 201 });
    }

    // Prepare arrays for bulk INSERT via unnest() — 1 SQL call instead of N
    const artworkCodes = validArtworks.map((aw, i) => `${code.trim()}-${aw.productId ?? i + 1}`);
    const coverImages  = validArtworks.map(aw => aw.imageUrl  ?? null);
    const artistNames  = validArtworks.map(aw => aw.artist    ?? null);
    const years        = validArtworks.map(aw => aw.year      ?? null);

    // Single INSERT for all artworks
    const artworkRows = await sql`
      INSERT INTO artworks (exhibition_id, code, cover_image_url, artist, year)
      SELECT
        ${exhibition.id}::uuid,
        unnest(${artworkCodes}::text[]),
        unnest(${coverImages}::text[]),
        unnest(${artistNames}::text[]),
        unnest(${years}::text[])
      RETURNING id, code
    `;

    // artworkRows is in the same order as validArtworks (unnest preserves order)
    const artworkIds = (artworkRows as { id: string }[]).map(r => r.id);

    // Single INSERT for all zh-TW translations
    const zhTitles  = validArtworks.map(aw => aw.title.trim());
    const zhDescs   = validArtworks.map(aw => aw.description ?? null);
    const zhUrls    = validArtworks.map(aw => aw.purchaseUrl ?? null);

    await sql`
      INSERT INTO artwork_translations (artwork_id, language_code, title, description, purchase_url, is_reviewed)
      SELECT
        unnest(${artworkIds}::uuid[]),
        'zh-TW',
        unnest(${zhTitles}::text[]),
        unnest(${zhDescs}::text[]),
        unnest(${zhUrls}::text[]),
        true
    `;

    // Single INSERT for en translations (only artworks with an English title)
    const enRows = validArtworks
      .map((aw, i) => ({
        id: artworkIds[i],
        title_en: aw.title_en?.trim() ?? null,
        description_en: aw.description_en ?? null,
        purchaseUrl: aw.purchaseUrl ?? null,
      }))
      .filter(r => r.title_en);

    if (enRows.length > 0) {
      const enIds    = enRows.map(r => r.id);
      const enTitles = enRows.map(r => r.title_en!);
      const enDescs  = enRows.map(r => r.description_en);
      const enUrls   = enRows.map(r =>
        r.purchaseUrl?.replace('uniart.com.tw/products/', 'uniart.com.tw/en/products/') ?? null
      );

      await sql`
        INSERT INTO artwork_translations (artwork_id, language_code, title, description, purchase_url, is_reviewed)
        SELECT
          unnest(${enIds}::uuid[]),
          'en',
          unnest(${enTitles}::text[]),
          unnest(${enDescs}::text[]),
          unnest(${enUrls}::text[]),
          true
      `;
    }

    return NextResponse.json(
      { data: { exhibition, artworksCreated: artworkRows.length } },
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
