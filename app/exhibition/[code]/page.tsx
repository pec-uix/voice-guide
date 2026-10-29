import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ExhibitionClient from './ExhibitionClient';
import type { LanguageCode } from '@/lib/types';

type ExhibitionRow = { id: string; code: string; name: string; name_en: string | null; description: string | null; description_en: string | null; review_url: string | null; cover_image_url: string | null; mobile_cover_image_url: string | null };
type ArtworkRow    = { id: string; code: string; cover_image_url: string | null; artist: string | null; year: string | null };
type TranslationRow = { artwork_id: string; language_code: string; title: string };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const snap = await db.collection('exhibitions').where('code', '==', code).limit(1).get();
  const name = snap.docs[0]?.data()?.name;
  return { title: name ? `${name} | 語音導覽` : '語音導覽' };
}

const VALID_LANGS: LanguageCode[] = ['zh-TW', 'en'];

export default async function ExhibitionPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const safeLang: LanguageCode = VALID_LANGS.includes(lang as LanguageCode)
    ? (lang as LanguageCode)
    : 'zh-TW';

  const exSnap = await db.collection('exhibitions').where('code', '==', code).limit(1).get();
  if (exSnap.empty) notFound();
  const exDoc = exSnap.docs[0];
  const exhibition = { id: exDoc.id, ...exDoc.data() } as unknown as ExhibitionRow;

  const artworksSnap = await db.collection('artworks')
    .where('exhibition_id', '==', exhibition.id)
    .orderBy('created_at', 'asc')
    .get();
  const artworks = artworksSnap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as ArtworkRow[];

  const translations: TranslationRow[] = [];
  await Promise.all(artworks.map(async (a) => {
    const transSnap = await db.collection('artworks').doc(a.id).collection('translations').get();
    transSnap.docs.forEach(d => {
      translations.push({ artwork_id: a.id, language_code: d.id, title: d.data().title ?? '' });
    });
  }));

  return (
    <ExhibitionClient
      exhibition={exhibition}
      artworks={artworks}
      translations={translations}
      initialLang={safeLang}
    />
  );
}
