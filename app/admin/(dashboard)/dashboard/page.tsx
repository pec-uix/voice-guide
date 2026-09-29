import { sql } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  // ── 1. 全站總覽 ────────────────────────────────────────────
  const [totals] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'scan')           AS total_scans,
      COUNT(*) FILTER (WHERE event_type = 'play')           AS total_plays,
      COUNT(*) FILTER (WHERE event_type = 'complete')       AS total_completes,
      COUNT(*) FILTER (WHERE event_type = 'click_purchase') AS total_purchases,
      COUNT(*) FILTER (WHERE event_type = 'click_review')   AS total_reviews
    FROM events
  `;

  // ── 2. 每日事件 (近 30 天) ─────────────────────────────────
  const daily = await sql`
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'Asia/Taipei', 'MM/DD') AS date,
      COUNT(*) FILTER (WHERE event_type = 'scan')       AS scans,
      COUNT(*) FILTER (WHERE event_type = 'play')       AS plays,
      COUNT(*) FILTER (WHERE event_type = 'complete')   AS completes
    FROM events
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Taipei', 'MM/DD'),
             DATE(created_at AT TIME ZONE 'Asia/Taipei')
    ORDER BY DATE(created_at AT TIME ZONE 'Asia/Taipei')
  `;

  // ── 3. 語言分佈 ────────────────────────────────────────────
  const langDist = await sql`
    SELECT language_code, COUNT(*)::int AS count
    FROM events
    WHERE event_type = 'scan' AND language_code IS NOT NULL
    GROUP BY language_code
    ORDER BY count DESC
  `;

  // ── 4. 作品成效排行 ────────────────────────────────────────
  const artworkStats = await sql`
    SELECT
      a.id, a.code,
      COALESCE(t.title, a.code) AS title,
      COUNT(*) FILTER (WHERE e.event_type = 'scan')           AS scans,
      COUNT(*) FILTER (WHERE e.event_type = 'play')           AS plays,
      COUNT(*) FILTER (WHERE e.event_type = 'complete')       AS completes,
      COUNT(*) FILTER (WHERE e.event_type = 'click_purchase') AS purchases
    FROM artworks a
    LEFT JOIN artwork_translations t ON t.artwork_id = a.id AND t.language_code = 'zh-TW'
    LEFT JOIN events e ON e.artwork_id = a.id
    GROUP BY a.id, a.code, t.title
    ORDER BY scans DESC
    LIMIT 20
  `;

  // ── 5. 展覽層級事件 ────────────────────────────────────────
  const exhibitionStats = await sql`
    SELECT
      ex.id, ex.name, ex.code,
      COUNT(*) FILTER (WHERE e.event_type = 'scan' AND e.exhibition_id = ex.id)         AS entry_scans,
      COUNT(*) FILTER (WHERE e.event_type = 'click_review' AND e.exhibition_id = ex.id) AS review_clicks,
      (SELECT COUNT(*)::int FROM artworks WHERE exhibition_id = ex.id)                   AS artwork_count
    FROM exhibitions ex
    LEFT JOIN events e ON e.exhibition_id = ex.id
    GROUP BY ex.id, ex.name, ex.code
    ORDER BY entry_scans DESC
  `;

  return (
    <DashboardClient
      totals={totals as never}
      daily={daily as never}
      langDist={langDist as never}
      artworkStats={artworkStats as never}
      exhibitionStats={exhibitionStats as never}
    />
  );
}
