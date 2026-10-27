import { sql } from '@/lib/db';
import { notFound } from 'next/navigation';
import ArtworkEditor from './ArtworkEditor';

type Props = { params: Promise<{ id: string }> };

export default async function ArtworkEditPage({ params }: Props) {
  const { id } = await params;

  const rows = await sql`SELECT * FROM artworks WHERE id = ${id}`;
  if (!rows[0]) notFound();
  const artwork = rows[0];

  const [translations, segments, exhibitions, prevNext] = await Promise.all([
    sql`SELECT * FROM artwork_translations WHERE artwork_id = ${id} ORDER BY language_code`,
    sql`
      SELECT s.id, s.segment_index, s.start_time::float AS start_time, s.end_time::float AS end_time,
        COALESCE(
          json_agg(
            json_build_object('language_code', t.language_code, 'text', t.text, 'is_reviewed', t.is_reviewed)
            ORDER BY t.language_code
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS texts
      FROM transcript_segments s
      LEFT JOIN transcript_segment_texts t ON t.segment_id = s.id
      WHERE s.artwork_id = ${id}
      GROUP BY s.id
      ORDER BY s.segment_index
    `,
    sql`SELECT id, name FROM exhibitions ORDER BY created_at DESC`,
    sql`
      SELECT
        (SELECT id FROM artworks
          WHERE exhibition_id IS NOT DISTINCT FROM ${artwork.exhibition_id}
            AND created_at < ${artwork.created_at}
          ORDER BY created_at DESC LIMIT 1) AS prev_id,
        (SELECT id FROM artworks
          WHERE exhibition_id IS NOT DISTINCT FROM ${artwork.exhibition_id}
            AND created_at > ${artwork.created_at}
          ORDER BY created_at ASC LIMIT 1) AS next_id
    `,
  ]);

  return (
    <ArtworkEditor
      artwork={artwork as never}
      translations={translations as never}
      segments={segments as never}
      exhibitions={exhibitions as never}
      prevId={(prevNext[0]?.prev_id as string) ?? null}
      nextId={(prevNext[0]?.next_id as string) ?? null}
    />
  );
}
