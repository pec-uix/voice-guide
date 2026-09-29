import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ExhibitionClient from './ExhibitionClient';
import type { LanguageCode } from '@/lib/types';

type ExhibitionRow = { id: string; code: string; name: string; description: string | null; review_url: string | null };
type ArtworkRow    = { id: string; code: string; cover_image_url: string | null; artist: string | null; year: string | null };
type TranslationRow = { artwork_id: string; language_code: string; title: string };

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const [row] = await sql`SELECT name FROM exhibitions WHERE code = ${code}`;
  return { title: row?.name ? `${row.name} | 語音導覽` : '語音導覽' };
}

const VALID_LANGS: LanguageCode[] = ['zh-TW', 'en', 'ja'];

export default async function ExhibitionPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const safeLang: LanguageCode = VALID_LANGS.includes(lang as LanguageCode)
    ? (lang as LanguageCode)
    : 'zh-TW';

  const exRows = await sql`SELECT * FROM exhibitions WHERE code = ${code}`;
  if (!exRows[0]) notFound();
  const exhibition = exRows[0] as unknown as ExhibitionRow;

  const artworks = (await sql`
    SELECT a.id, a.code, a.cover_image_url, a.artist, a.year
    FROM artworks a
    WHERE a.exhibition_id = ${exhibition.id}
    ORDER BY a.created_at ASC
  `) as unknown as ArtworkRow[];

  const artworkIds = artworks.map((a) => a.id);
  const translations: TranslationRow[] =
    artworkIds.length > 0
      ? (await sql`
          SELECT artwork_id, language_code, title
          FROM artwork_translations
          WHERE artwork_id = ANY(${artworkIds}::uuid[])
        `) as unknown as TranslationRow[]
      : [];

  return (
    <ExhibitionClient
      exhibition={exhibition}
      artworks={artworks}
      translations={translations}
      initialLang={safeLang}
    />
  );
}
