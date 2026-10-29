import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArtworkViewer from './ArtworkViewer';
import type { Artwork, ArtworkTranslation, LanguageCode } from '@/lib/types';

interface SegmentWithTexts {
  id: string;
  segment_index: number;
  start_time: number;
  end_time: number;
  texts: { language_code: string; text: string }[];
}

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const snap = await db.collection('artworks').where('code', '==', code).limit(1).get();
  if (snap.empty) return { title: '語音導覽' };
  const artworkId = snap.docs[0].id;
  const transDoc = await db.collection('artworks').doc(artworkId).collection('translations').doc('zh-TW').get();
  const title = transDoc.data()?.title;
  return { title: title ? `${title} | 語音導覽` : '語音導覽', alternates: { canonical: `/artwork/${code}?lang=${lang}` } };
}

const VALID_LANGS: LanguageCode[] = ['zh-TW', 'en'];

export default async function ArtworkPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const safeLang: LanguageCode = VALID_LANGS.includes(lang as LanguageCode)
    ? (lang as LanguageCode)
    : 'zh-TW';

  const snap = await db.collection('artworks').where('code', '==', code).limit(1).get();
  if (snap.empty) notFound();
  const artworkDoc = snap.docs[0];
  const artwork = { id: artworkDoc.id, ...artworkDoc.data() } as unknown as Artwork;

  let exhibitionId: string | null = null;
  let exhibitionCode: string | null = null;
  let isLastInExhibition = false;
  let prevCode: string | null = null;
  let nextCode: string | null = null;

  if (artwork.exhibition_id) {
    exhibitionId = artwork.exhibition_id;
    const exDoc = await db.collection('exhibitions').doc(artwork.exhibition_id).get();
    exhibitionCode = exDoc.data()?.code ?? null;

    const siblingSnap = await db.collection('artworks')
      .where('exhibition_id', '==', artwork.exhibition_id)
      .orderBy('created_at', 'asc')
      .get();
    const siblings = siblingSnap.docs;
    const idx = siblings.findIndex(d => d.id === artwork.id);
    if (idx !== -1) {
      isLastInExhibition = idx === siblings.length - 1;
      prevCode = idx > 0 ? (siblings[idx - 1].data().code ?? null) : null;
      nextCode = idx < siblings.length - 1 ? (siblings[idx + 1].data().code ?? null) : null;
    }
  }

  const translationsSnap = await db.collection('artworks').doc(artwork.id).collection('translations').get();
  const translations = translationsSnap.docs.map(d => ({ language_code: d.id, ...d.data() })) as unknown as ArtworkTranslation[];

  const segsSnap = await db.collection('artworks').doc(artwork.id).collection('transcript_segments').orderBy('segment_index').get();
  const segments = await Promise.all(segsSnap.docs.map(async (segDoc) => {
    const seg = segDoc.data();
    const textsSnap = await db.collection('artworks').doc(artwork.id).collection('transcript_segments').doc(segDoc.id).collection('texts').get();
    const texts = textsSnap.docs.map(t => ({ language_code: t.id, ...t.data() }));
    return { ...seg, texts };
  })) as unknown as SegmentWithTexts[];

  return (
    <ArtworkViewer
      artwork={artwork}
      translations={translations}
      segments={segments}
      initialLang={safeLang}
      exhibitionId={exhibitionId ?? undefined}
      exhibitionCode={exhibitionCode ?? undefined}
      isLastInExhibition={isLastInExhibition}
      prevCode={prevCode ?? undefined}
      nextCode={nextCode ?? undefined}
    />
  );
}
