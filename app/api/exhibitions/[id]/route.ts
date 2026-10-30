import { auth } from '@/auth';
import { db, batchDeletePaths } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const exhibitionDoc = await db.collection('exhibitions').doc(id).get();
    if (!exhibitionDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const exhibition = exhibitionDoc.data()!;

    const artworksSnap = await db.collection('artworks').where('exhibition_id', '==', id).get();
    artworksSnap.docs.sort((a, b) =>
      ((a.data().created_at as string) ?? '').localeCompare((b.data().created_at as string) ?? '')
    );
    const artworks = await Promise.all(artworksSnap.docs.map(async (artworkDoc) => {
      const artwork = artworkDoc.data();
      const translationDoc = await db.collection('artworks').doc(artworkDoc.id).collection('translations').doc('zh-TW').get();
      const t = translationDoc.exists ? translationDoc.data()! : {};
      return {
        ...artwork,
        id: artworkDoc.id,
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

    const pathsToDelete: string[] = [];

    // 1. Get all artworks (1 query)
    const artworksSnap = await db.collection('artworks').where('exhibition_id', '==', id).get();

    // 2. For each artwork: translations use known IDs (no query needed);
    //    only query transcript_segments (variable IDs).
    //    Artwork-level events are skipped to stay under subrequest limits —
    //    they're analytics-only and acceptable to leave orphaned.
    await Promise.all(artworksSnap.docs.map(async (artworkDoc) => {
      const aid = artworkDoc.id;

      // Known translation IDs — batchWrite delete is a no-op if they don't exist
      for (const lang of ['zh-TW', 'en', 'ja']) {
        pathsToDelete.push(`artworks/${aid}/translations/${lang}`);
      }

      const segsSnap = await db.collection('artworks').doc(aid).collection('transcript_segments').get();
      if (segsSnap.docs.length > 0) {
        await Promise.all(segsSnap.docs.map(async (segDoc) => {
          const textsSnap = await db.collection('artworks').doc(aid)
            .collection('transcript_segments').doc(segDoc.id).collection('texts').get();
          textsSnap.docs.forEach(t =>
            pathsToDelete.push(`artworks/${aid}/transcript_segments/${segDoc.id}/texts/${t.id}`)
          );
          pathsToDelete.push(`artworks/${aid}/transcript_segments/${segDoc.id}`);
        }));
      }

      pathsToDelete.push(`artworks/${aid}`);
    }));

    // 3. Exhibition-level events and feedback (2 queries, parallel)
    const [exEventsSnap, feedbackSnap] = await Promise.all([
      db.collection('events').where('exhibition_id', '==', id).get(),
      db.collection('exhibition_feedback').where('exhibition_id', '==', id).get(),
    ]);
    exEventsSnap.docs.forEach(e => pathsToDelete.push(`events/${e.id}`));
    feedbackSnap.docs.forEach(f => pathsToDelete.push(`exhibition_feedback/${f.id}`));
    pathsToDelete.push(`exhibitions/${id}`);

    // 4. One batchWrite call deletes everything
    await batchDeletePaths(pathsToDelete);

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[DELETE exhibition]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
