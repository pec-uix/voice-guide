import { auth } from '@/auth';
import { db, batchDeletePaths } from '@/lib/firebase-admin';
import { translateBoth } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const artworkDoc = await db.collection('artworks').doc(id).get();
    if (!artworkDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const artwork = artworkDoc.data()!;

    const translationsSnap = await db.collection('artworks').doc(id).collection('translations').orderBy('__name__').get();
    const translations = translationsSnap.docs.map(d => ({ language_code: d.id, ...d.data() }));

    const segsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').orderBy('segment_index').get();
    const segments = await Promise.all(segsSnap.docs.map(async (segDoc) => {
      const seg = segDoc.data();
      const textsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').doc(segDoc.id).collection('texts').get();
      const texts = textsSnap.docs.map(t => ({ language_code: t.id, ...t.data() }));
      return { ...seg, texts };
    }));

    return NextResponse.json({ data: { ...artwork, translations, segments } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch artwork' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { exhibition_id, code, cover_image_url, artist, year, title, description, purchase_url } = body;

    const existingDoc = await db.collection('artworks').doc(id).get();
    if (!existingDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (code !== undefined) {
      const codeCheck = await db.collection('artworks').where('code', '==', code.trim()).limit(1).get();
      if (!codeCheck.empty && codeCheck.docs[0].id !== id) {
        return NextResponse.json({ error: 'Artwork code already exists' }, { status: 409 });
      }
    }

    const now = new Date().toISOString();
    const artworkUpdates: Record<string, unknown> = { updated_at: now };
    if (exhibition_id !== undefined) artworkUpdates.exhibition_id = exhibition_id;
    if (code !== undefined) artworkUpdates.code = code.trim();
    if (cover_image_url !== undefined) artworkUpdates.cover_image_url = cover_image_url;
    if (artist !== undefined) artworkUpdates.artist = artist;
    if (year !== undefined) artworkUpdates.year = year;
    await db.collection('artworks').doc(id).update(artworkUpdates);
    const updatedArtworkDoc = await db.collection('artworks').doc(id).get();
    const artwork = updatedArtworkDoc.data()!;

    let zhTranslation = null;
    if (title !== undefined || description !== undefined || purchase_url !== undefined) {
      const existingZhDoc = await db.collection('artworks').doc(id).collection('translations').doc('zh-TW').get();
      const existingZh = existingZhDoc.exists ? existingZhDoc.data()! : {};
      const newTitle = title?.trim() || existingZh.title || '';
      const newDesc = description !== undefined ? description : (existingZh.description ?? null);
      const newUrl = purchase_url !== undefined ? purchase_url : (existingZh.purchase_url ?? null);
      zhTranslation = { title: newTitle, description: newDesc, purchase_url: newUrl, audio_url: existingZh.audio_url ?? null, is_reviewed: true, created_at: existingZh.created_at ?? now, updated_at: now };
      await db.collection('artworks').doc(id).collection('translations').doc('zh-TW').set(zhTranslation, { merge: true });

      if (newTitle) {
        const [titleT, descT] = await Promise.all([
          translateBoth(newTitle),
          newDesc ? translateBoth(newDesc) : Promise.resolve({ en: null, failed: false }),
        ]);
        const existingEnDoc = await db.collection('artworks').doc(id).collection('translations').doc('en').get();
        const existingEn = existingEnDoc.exists ? existingEnDoc.data()! : {};
        await db.collection('artworks').doc(id).collection('translations').doc('en').set({
          title: titleT.en ?? '', description: descT.en ?? null,
          purchase_url: newUrl, audio_url: existingEn.audio_url ?? null,
          is_reviewed: false, created_at: existingEn.created_at ?? now, updated_at: now,
        }, { merge: true });
        return NextResponse.json({ data: { ...artwork, zh_translation: zhTranslation }, translation_warning: titleT.failed });
      }
    }

    return NextResponse.json({ data: { ...artwork, zh_translation: zhTranslation } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update artwork' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const existingDoc = await db.collection('artworks').doc(id).get();
    if (!existingDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const pathsToDelete: string[] = [];

    // Known translation IDs — batchWrite delete is no-op if they don't exist
    for (const lang of ['zh-TW', 'en', 'ja']) {
      pathsToDelete.push(`artworks/${id}/translations/${lang}`);
    }

    const segsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').get();
    if (segsSnap.docs.length > 0) {
      await Promise.all(segsSnap.docs.map(async (segDoc) => {
        const textsSnap = await db.collection('artworks').doc(id)
          .collection('transcript_segments').doc(segDoc.id).collection('texts').get();
        textsSnap.docs.forEach(t =>
          pathsToDelete.push(`artworks/${id}/transcript_segments/${segDoc.id}/texts/${t.id}`)
        );
        pathsToDelete.push(`artworks/${id}/transcript_segments/${segDoc.id}`);
      }));
    }

    pathsToDelete.push(`artworks/${id}`);
    await batchDeletePaths(pathsToDelete);

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to delete artwork' }, { status: 500 });
  }
}
