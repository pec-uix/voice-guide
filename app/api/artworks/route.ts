import { requireAdmin } from '@/lib/verify-auth';
import { db } from '@/lib/firebase-admin';
import { translateBoth } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exhibitionId = searchParams.get('exhibition_id');

  try {
    const artworksSnap = exhibitionId
      ? await db.collection('artworks').where('exhibition_id', '==', exhibitionId).get()
      : await db.collection('artworks').orderBy('created_at', 'desc').get();
    if (exhibitionId) {
      artworksSnap.docs.sort((a, b) =>
        ((a.data().created_at as string) ?? '').localeCompare((b.data().created_at as string) ?? '')
      );
    }

    const rows = await Promise.all(artworksSnap.docs.map(async (doc) => {
      const artwork = doc.data();
      const tDoc = await db.collection('artworks').doc(doc.id).collection('translations').doc('zh-TW').get();
      const t = tDoc.exists ? tDoc.data()! : {};
      return { ...artwork, id: doc.id, title: t.title ?? null, audio_url: t.audio_url ?? null, is_reviewed: t.is_reviewed ?? null };
    }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch artworks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { exhibition_id, code, cover_image_url, artist, year, title, description, purchase_url } = body;

    if (!code?.trim() || !title?.trim()) {
      return NextResponse.json({ error: 'code and title are required' }, { status: 400 });
    }

    const codeCheck = await db.collection('artworks').where('code', '==', code.trim()).limit(1).get();
    if (!codeCheck.empty) {
      return NextResponse.json({ error: 'Artwork code already exists' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const artworkRef = db.collection('artworks').doc();
    const artwork = {
      id: artworkRef.id,
      exhibition_id: exhibition_id ?? null,
      code: code.trim(),
      cover_image_url: cover_image_url ?? null,
      artist: artist ?? null,
      year: year ?? null,
      created_at: now,
      updated_at: now,
    };
    await artworkRef.set(artwork);

    const zhTranslation = {
      title: title.trim(),
      description: description ?? null,
      purchase_url: purchase_url ?? null,
      audio_url: null,
      is_reviewed: true,
      created_at: now,
      updated_at: now,
    };
    await artworkRef.collection('translations').doc('zh-TW').set(zhTranslation);

    const [titleT, descT] = await Promise.all([
      title ? translateBoth(title) : Promise.resolve({ en: null, failed: false }),
      description ? translateBoth(description) : Promise.resolve({ en: null, failed: false }),
    ]);

    const translationWarning = titleT.failed;
    const enT = {
      title: titleT.en ?? '',
      description: descT.en ?? null,
      purchase_url: purchase_url ?? null,
      audio_url: null,
      is_reviewed: false,
      created_at: now,
      updated_at: now,
    };
    await artworkRef.collection('translations').doc('en').set(enT);

    return NextResponse.json(
      { data: { ...artwork, translations: [zhTranslation, enT] }, translation_warning: translationWarning },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create artwork' }, { status: 500 });
  }
}
