import { sql } from '@/lib/db';
import ArtworksClient from './ArtworksClient';

type Props = { searchParams: Promise<{ exhibition_id?: string }> };

export default async function ArtworksPage({ searchParams }: Props) {
  const { exhibition_id } = await searchParams;

  const exhibitions = await sql`SELECT id, code, name FROM exhibitions ORDER BY created_at DESC`;

  const artworks = exhibition_id
    ? await sql`
        SELECT a.id, a.code, a.artist, a.year, a.exhibition_id, a.cover_image_url, a.updated_at,
          t.title,
          (SELECT COUNT(*) FROM artwork_translations WHERE artwork_id = a.id AND is_reviewed = false)::int AS pending_count
        FROM artworks a
        LEFT JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
        WHERE a.exhibition_id = ${exhibition_id}
        ORDER BY a.created_at ASC
      `
    : await sql`
        SELECT a.id, a.code, a.artist, a.year, a.exhibition_id, a.cover_image_url, a.updated_at,
          t.title,
          (SELECT COUNT(*) FROM artwork_translations WHERE artwork_id = a.id AND is_reviewed = false)::int AS pending_count
        FROM artworks a
        LEFT JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
        ORDER BY a.created_at DESC
      `;

  return (
    <ArtworksClient
      artworks={artworks as never}
      exhibitions={exhibitions as never}
      initialExhibitionId={exhibition_id ?? null}
    />
  );
}
