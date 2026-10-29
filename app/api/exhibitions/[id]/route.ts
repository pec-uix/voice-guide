import { auth } from '@/auth';
import { db } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const exhibitionDoc = await db.collection('exhibitions').doc(id).get();
    if (!exhibitionDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const exhibition = exhibitionDoc.data()!;

    const artworksSnap = await db.collection('artworks').where('exhibition_id', '==', id).orderBy('created_at', 'asc').get();
    const artworks = await Promise.all(artworksSnap.docs.map(async (artworkDoc) => {
      const artwork = artworkDoc.data();
      const translationDoc = await db.collection('artworks').doc(artworkDoc.id).collection('translations').doc('zh-TW').get();
      const t = translationDoc.exists ? translationDoc.data()! : {};
      return {
        ...artwork,
        title: t.title ?? null,
        translation_description: t.description ?? null,
        audio_url: t.audio_url ?? null,
        purchase_url: t.purchase_url ?? null,
      };
    }));

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

    const existingDoc = await db.collection('exhibitions').doc(id).get();
    if (!existingDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (code !== undefined) {
      const codeCheck = await db.collection('exhibitions').where('code', '==', code.trim()).limit(1).get();
      if (!codeCheck.empty && codeCheck.docs[0].id !== id) {
        return NextResponse.json({ error: 'Exhibition code already exists' }, { status: 409 });
      }
    }

    const updates: Record<string, unknown> = {};
    if (code !== undefined) updates.code = code.trim();
    if (name !== undefined) updates.name = name.trim();
    if (name_en !== undefined) updates.name_en = name_en;
    if (description !== undefined) updates.description = description;
    if (description_en !== undefined) updates.description_en = description_en;
    if (review_url !== undefined) updates.review_url = review_url;
    if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url;
    if (mobile_cover_image_url !== undefined) updates.mobile_cover_image_url = mobile_cover_image_url;

    await db.collection('exhibitions').doc(id).update(updates);
    const updatedDoc = await db.collection('exhibitions').doc(id).get();
    return NextResponse.json({ data: updatedDoc.data() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update exhibition' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const existingDoc = await db.collection('exhibitions').doc(id).get();
    if (!existingDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const artworksSnap = await db.collection('artworks').where('exhibition_id', '==', id).get();
    for (const artworkDoc of artworksSnap.docs) {
      const artworkId = artworkDoc.id;
      const segsSnap = await db.collection('artworks').doc(artworkId).collection('transcript_segments').get();
      for (const segDoc of segsSnap.docs) {
        const textsSnap = await db.collection('artworks').doc(artworkId).collection('transcript_segments').doc(segDoc.id).collection('texts').get();
        for (const textDoc of textsSnap.docs) await textDoc.ref.delete();
        await segDoc.ref.delete();
      }
      const translationsSnap = await db.collection('artworks').doc(artworkId).collection('translations').get();
      for (const tDoc of translationsSnap.docs) await tDoc.ref.delete();
      const eventsSnap = await db.collection('events').where('artwork_id', '==', artworkId).get();
      for (const eDoc of eventsSnap.docs) await eDoc.ref.delete();
      await artworkDoc.ref.delete();
    }

    const exEventsSnap = await db.collection('events').where('exhibition_id', '==', id).get();
    for (const eDoc of exEventsSnap.docs) await eDoc.ref.delete();
    const feedbackSnap = await db.collection('exhibition_feedback').where('exhibition_id', '==', id).get();
    for (const fDoc of feedbackSnap.docs) await fDoc.ref.delete();
    await db.collection('exhibitions').doc(id).delete();

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DELETE exhibition]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
