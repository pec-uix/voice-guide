import { db } from '@/lib/firebase-admin';
import ArtworksClient from './ArtworksClient';

type Props = { searchParams: Promise<{ exhibition_id?: string }> };

export default async function ArtworksPage({ searchParams }: Props) {
  const { exhibition_id } = await searchParams;

  const artworksQuery = exhibition_id
    ? db.collection('artworks').where('exhibition_id', '==', exhibition_id)
    : db.collection('artworks').orderBy('created_at', 'desc');

  const [exhibitionsSnap, artworksSnap] = await Promise.all([
    db.collection('exhibitions').orderBy('created_at', 'desc').get(),
    artworksQuery.get(),
  ]);

  const exhibitions = exhibitionsSnap.docs.map(d => ({ id: d.id, code: d.data().code as string, name: d.data().name as string }));

  if (exhibition_id) {
    artworksSnap.docs.sort((a, b) =>
      ((a.data().created_at as string) ?? '').localeCompare((b.data().created_at as string) ?? '')
    );
  }

  const artworks = await Promise.all(artworksSnap.docs.map(async (artDoc) => {
    const data = artDoc.data();
    const translationsSnap = await db.collection('artworks').doc(artDoc.id).collection('translations').get();
    const zhTrans = translationsSnap.docs.find(d => d.id === 'zh-TW')?.data();
    const pendingCount = translationsSnap.docs.filter(d => !d.data().is_reviewed).length;
    return {
      id: artDoc.id,
      code: data.code as string,
      artist: (data.artist as string) ?? null,
      year: (data.year as string) ?? null,
      exhibition_id: (data.exhibition_id as string) ?? null,
      cover_image_url: (data.cover_image_url as string) ?? null,
      updated_at: data.updated_at as string,
      title: (zhTrans?.title as string) ?? null,
      pending_count: pendingCount,
    };
  }));

  return (
    <ArtworksClient
      artworks={artworks as never}
      exhibitions={exhibitions as never}
      initialExhibitionId={exhibition_id ?? null}
    />
  );
}
