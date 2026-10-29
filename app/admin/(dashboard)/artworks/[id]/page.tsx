import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import ArtworkEditor from './ArtworkEditor';

type Props = { params: Promise<{ id: string }> };

export default async function ArtworkEditPage({ params }: Props) {
  const { id } = await params;

  const artworkDoc = await db.collection('artworks').doc(id).get();
  if (!artworkDoc.exists) notFound();
  const artwork = { id: artworkDoc.id, ...artworkDoc.data() } as { id: string; exhibition_id?: string; [key: string]: unknown };

  const [translationsSnap, segsSnap, exhibitionsSnap] = await Promise.all([
    db.collection('artworks').doc(id).collection('translations').orderBy('__name__').get(),
    db.collection('artworks').doc(id).collection('transcript_segments').orderBy('segment_index').get(),
    db.collection('exhibitions').orderBy('created_at', 'desc').get(),
  ]);

  const translations = translationsSnap.docs.map(d => ({ language_code: d.id, ...d.data() }));

  const segments = await Promise.all(segsSnap.docs.map(async (segDoc) => {
    const seg = segDoc.data();
    const textsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').doc(segDoc.id).collection('texts').get();
    const texts = textsSnap.docs.map(t => ({ language_code: t.id, ...t.data() }));
    return { ...seg, texts };
  }));

  const exhibitions = exhibitionsSnap.docs.map(d => ({ id: d.id, name: d.data().name as string }));

  let prevId: string | null = null;
  let nextId: string | null = null;
  const exhibitionId = artwork.exhibition_id as string | null | undefined;
  if (exhibitionId) {
    const siblingsSnap = await db.collection('artworks')
      .where('exhibition_id', '==', exhibitionId)
      .orderBy('created_at', 'asc')
      .get();
    const siblings = siblingsSnap.docs;
    const idx = siblings.findIndex(d => d.id === id);
    if (idx !== -1) {
      prevId = idx > 0 ? siblings[idx - 1].id : null;
      nextId = idx < siblings.length - 1 ? siblings[idx + 1].id : null;
    }
  }

  return (
    <ArtworkEditor
      artwork={artwork as never}
      translations={translations as never}
      segments={segments as never}
      exhibitions={exhibitions as never}
      prevId={prevId}
      nextId={nextId}
    />
  );
}
