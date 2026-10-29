import { db } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import WorksClient from './WorksClient';
import type { LanguageCode } from '@/lib/types';

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

const VALID_LANGS: LanguageCode[] = ['zh-TW', 'en'];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const snap = await db.collection('exhibitions').where('code', '==', code).limit(1).get();
  const name = snap.docs[0]?.data()?.name;
  return { title: name ? `${name} — 所有作品 | 語音導覽` : '所有作品' };
}

export default async function WorksPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const safeLang: LanguageCode = VALID_LANGS.includes(lang as LanguageCode) ? (lang as LanguageCode) : 'zh-TW';

  const exSnap = await db.collection('exhibitions').where('code', '==', code).limit(1).get();
  if (exSnap.empty) notFound();
  const exDoc = exSnap.docs[0];
  const exhibition = { id: exDoc.id, code: exDoc.data().code as string, name: exDoc.data().name as string };

  const artworksSnap = await db.collection('artworks')
    .where('exhibition_id', '==', exhibition.id)
    .orderBy('created_at', 'asc')
    .get();
  const artworks = artworksSnap.docs.map(d => {
    const data = d.data();
    return { id: d.id, code: data.code as string, cover_image_url: (data.cover_image_url as string) ?? null, artist: (data.artist as string) ?? null, year: (data.year as string) ?? null };
  });

  const translations: { artwork_id: string; language_code: string; title: string }[] = [];
  await Promise.all(artworks.map(async (a) => {
    const transSnap = await db.collection('artworks').doc(a.id).collection('translations').get();
    transSnap.docs.forEach(d => {
      translations.push({ artwork_id: a.id, language_code: d.id, title: (d.data().title as string) ?? '' });
    });
  }));

  return (
    <WorksClient
      exhibition={exhibition}
      artworks={artworks}
      translations={translations}
      initialLang={safeLang}
    />
  );
}
