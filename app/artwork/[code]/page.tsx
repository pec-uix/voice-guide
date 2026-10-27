import { sql } from '@/lib/db';
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
  const [row] = await sql`
    SELECT t.title FROM artworks a
    JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
    WHERE a.code = ${code}
  `;
  return { title: row?.title ? `${row.title} | 語音導覽` : '語音導覽', alternates: { canonical: `/artwork/${code}?lang=${lang}` } };
}

const VALID_LANGS: LanguageCode[] = ['zh-TW', 'en'];

export default async function ArtworkPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { lang = 'zh-TW' } = await searchParams;
  const safeLang: LanguageCode = VALID_LANGS.includes(lang as LanguageCode)
    ? (lang as LanguageCode)
    : 'zh-TW';

  const rows = await sql`SELECT * FROM artworks WHERE code = ${code}`;
  if (!rows[0]) notFound();
  const artwork = rows[0] as unknown as Artwork;

  let exhibitionId: string | null = null;
  let exhibitionCode: string | null = null;
  let isLastInExhibition = false;
  let prevCode: string | null = null;
  let nextCode: string | null = null;
  if (artwork.exhibition_id) {
    exhibitionId = artwork.exhibition_id;
    const [exRow] = await sql`SELECT code FROM exhibitions WHERE id = ${artwork.exhibition_id}`;
    exhibitionCode = exRow?.code ?? null;
    const [lastRow] = await sql`
      SELECT id FROM artworks
      WHERE exhibition_id = ${artwork.exhibition_id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    isLastInExhibition = lastRow?.id === artwork.id;

    const [navRow] = await sql`
      WITH ordered AS (
        SELECT id, code,
          LAG(code)  OVER (ORDER BY created_at ASC) AS prev_code,
          LEAD(code) OVER (ORDER BY created_at ASC) AS next_code
        FROM artworks
        WHERE exhibition_id = ${artwork.exhibition_id}
      )
      SELECT prev_code, next_code FROM ordered WHERE id = ${artwork.id}
    `;
    prevCode = navRow?.prev_code ?? null;
    nextCode = navRow?.next_code ?? null;
  }

  const translations = (await sql`
    SELECT * FROM artwork_translations WHERE artwork_id = ${artwork.id}
  `) as unknown as ArtworkTranslation[];

  const segments = (await sql`
    SELECT
      s.id, s.segment_index,
      s.start_time::float AS start_time,
      s.end_time::float   AS end_time,
      COALESCE(
        json_agg(
          json_build_object('language_code', t.language_code, 'text', t.text)
          ORDER BY t.language_code
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) AS texts
    FROM transcript_segments s
    LEFT JOIN transcript_segment_texts t ON t.segment_id = s.id
    WHERE s.artwork_id = ${artwork.id}
    GROUP BY s.id
    ORDER BY s.segment_index
  `) as unknown as SegmentWithTexts[];

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
