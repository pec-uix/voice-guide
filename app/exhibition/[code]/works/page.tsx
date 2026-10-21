import { sql } from '@/lib/db';
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
  const [row] = await sql`SELECT name FROM exhibitions WHERE code = ${code}`;
  return { title: row?.name ? `${row.name} — 所有作品 | 語音導覽` : '所有作品' };
}

export default async function WorksPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const safeLang: LanguageCode = VALID_LANGS.includes(lang as LanguageCode) ? (lang as LanguageCode) : 'zh-TW';

  const exRows = await sql`SELECT id, code, name FROM exhibitions WHERE code = ${code}`;
  if (!exRows[0]) notFound();
  const exhibition = exRows[0] as { id: string; code: string; name: string };

  const artworks = await sql`
    SELECT id, code, cover_image_url, artist, year
    FROM artworks
    WHERE exhibition_id = ${exhibition.id}
    ORDER BY created_at ASC
  `;

  const artworkIds = artworks.map((a) => a.id);
  const translations = artworkIds.length > 0
    ? await sql`
        SELECT artwork_id, language_code, title
        FROM artwork_translations
        WHERE artwork_id = ANY(${artworkIds}::uuid[])
      `
    : [];

  return (
    <WorksClient
      exhibition={exhibition}
      artworks={artworks as { id: string; code: string; cover_image_url: string | null; artist: string | null; year: string | null }[]}
      translations={translations as { artwork_id: string; language_code: string; title: string }[]}
      initialLang={safeLang}
    />
  );
}
