import { db, batchSetDocuments } from '@/lib/firebase-admin';
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
    const now = new Date().toISOString();
    const exhibition = {
      code: code.trim(),
      name: name.trim(),
      name_en: name_en ?? null,
      description: description ?? null,
      description_en: description_en ?? null,
      cover_image_url: cover_image_url ?? null,
      mobile_cover_image_url: mobile_cover_image_url ?? null,
      created_at: now,
    };

    const validArtworks = (artworks ?? []).filter(aw => aw.title?.trim());

    // Batch 1: exhibition + all artwork parent documents
    const parentDocs: Array<{ path: string; data: Record<string, unknown> }> = [
      { path: `exhibitions/${exRef.id}`, data: exhibition },
    ];
    const artworkRefs: Array<{ id: string; aw: ArtworkInput; artworkCode: string }> = [];

    for (let i = 0; i < validArtworks.length; i++) {
      const aw = validArtworks[i];
      const artworkRef = db.collection('artworks').doc();
      const artworkCode = `${code.trim()}-${aw.productId ?? i + 1}`;
      artworkRefs.push({ id: artworkRef.id, aw, artworkCode });

      parentDocs.push({
        path: `artworks/${artworkRef.id}`,
        data: {
          exhibition_id: exRef.id,
          code: artworkCode,
          cover_image_url: aw.imageUrl ?? null,
          artist: aw.artist ?? null,
          year: aw.year ?? null,
          created_at: now,
          updated_at: now,
        },
      });
    }

    await batchSetDocuments(parentDocs);

    // Batch 2: translations (parent artworks now exist)
    const translationDocs: Array<{ path: string; data: Record<string, unknown> }> = [];
    for (const { id: artworkId, aw } of artworkRefs) {
      translationDocs.push({
        path: `artworks/${artworkId}/translations/zh-TW`,
        data: {
          title: aw.title.trim(),
          description: aw.description ?? null,
          purchase_url: aw.purchaseUrl ?? null,
          audio_url: null,
          is_reviewed: true,
          created_at: now,
          updated_at: now,
        },
      });

      if (aw.title_en?.trim()) {
        const enPurchaseUrl = aw.purchaseUrl?.replace('uniart.com.tw/products/', 'uniart.com.tw/en/products/') ?? null;
        translationDocs.push({
          path: `artworks/${artworkId}/translations/en`,
          data: {
            title: aw.title_en.trim(),
            description: aw.description_en ?? null,
            purchase_url: enPurchaseUrl,
            audio_url: null,
            is_reviewed: true,
            created_at: now,
            updated_at: now,
          },
        });
      }
    }

    if (translationDocs.length > 0) await batchSetDocuments(translationDocs);

    return NextResponse.json(
      { data: { exhibition: { id: exRef.id, ...exhibition }, artworksCreated: validArtworks.length } },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `建立失敗：${msg}` }, { status: 500 });
  }
}
