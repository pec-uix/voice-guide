import { sql } from '@/lib/db';
import ExhibitionsClient from './ExhibitionsClient';

export default async function ExhibitionsPage() {
  const exhibitions = await sql`
    SELECT e.*,
      COUNT(a.id)::int AS artwork_count
    FROM exhibitions e
    LEFT JOIN artworks a ON a.exhibition_id = e.id
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;

  return <ExhibitionsClient exhibitions={exhibitions as never} />;
}
