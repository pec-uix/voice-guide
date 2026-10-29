import { db } from '@/lib/firebase-admin';
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
    const existing = await db.collection('exhibitions').where('code', '==', code.trim()).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: '展覽代碼已存在，請換一個' }, { status: 409 });
    }

    const exRef = db.collection('exhibitions').doc();
    const exhibition = {
      id: exRef.id,
      code: code.trim(),
      name: name.trim(),
      name_en: name_en ?? null,
      description: description ?? null,
      description_en: description_en ?? null,
      cover_image_url: cover_image_url ?? null,
      mobile_cover_image_url: mobile_cover_image_url ?? null,
      created_at: new Date().toISOString(),
    };
    await exRef.set(exhibition);

    const validArtworks = (artworks ?? []).filter(aw => aw.title?.trim());
    if (validArtworks.length === 0) {
      return NextResponse.json({ data: { exhibition, artworksCreated: 0 } }, { status: 201 });
    }

    const now = new Date().toISOString();
    await Promise.all(validArtworks.map(async (aw, i) => {
      const artworkRef = db.collection('artworks').doc();
      const artworkCode = `${code.trim()}-${aw.productId ?? i + 1}`;
      const artwork = {
        id: artworkRef.id,
        exhibition_id: exRef.id,
        code: artworkCode,
        cover_image_url: aw.imageUrl ?? null,
        artist: aw.artist ?? null,
        year: aw.year ?? null,
        created_at: now,
        updated_at: now,
      };
      await artworkRef.set(artwork);

      await artworkRef.collection('translations').doc('zh-TW').set({
        title: aw.title.trim(),
        description: aw.description ?? null,
        purchase_url: aw.purchaseUrl ?? null,
        audio_url: null,
        is_reviewed: true,
        created_at: now,
        updated_at: now,
      });

      if (aw.title_en?.trim()) {
        const enPurchaseUrl = aw.purchaseUrl?.replace('uniart.com.tw/products/', 'uniart.com.tw/en/products/') ?? null;
        await artworkRef.collection('translations').doc('en').set({
          title: aw.title_en.trim(),
          description: aw.description_en ?? null,
          purchase_url: enPurchaseUrl,
          audio_url: null,
          is_reviewed: true,
          created_at: now,
          updated_at: now,
        });
      }
    }));

    return NextResponse.json(
      { data: { exhibition, artworksCreated: validArtworks.length } },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '建立失敗' }, { status: 500 });
  }
}
