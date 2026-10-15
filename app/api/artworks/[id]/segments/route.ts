import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { translateBoth } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const rows = await sql`
      SELECT s.*,
        json_agg(
          json_build_object(
            'id', t.id, 'language_code', t.language_code,
            'text', t.text, 'is_reviewed', t.is_reviewed
          ) ORDER BY t.language_code
        ) FILTER (WHERE t.id IS NOT NULL) AS texts
      FROM transcript_segments s
      LEFT JOIN transcript_segment_texts t ON t.segment_id = s.id
      WHERE s.artwork_id = ${id}
      GROUP BY s.id
      ORDER BY s.segment_index
    `;
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
  }
}

interface SegmentInput {
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const segments: SegmentInput[] = body.segments;

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: 'segments array is required' }, { status: 400 });
    }

    // Validate each segment
    for (const s of segments) {
      if (typeof s.start_time !== 'number' || typeof s.end_time !== 'number') {
        return NextResponse.json({ error: 'start_time and end_time must be numbers' }, { status: 400 });
      }
      if (s.end_time <= s.start_time) {
        return NextResponse.json(
          { error: `Segment ${s.segment_index}: end_time must be greater than start_time` },
          { status: 400 },
        );
      }
    }

    // Check for time overlaps
    const sorted = [...segments].sort((a, b) => a.start_time - b.start_time);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        return NextResponse.json(
          { error: `Segments overlap: index ${sorted[i - 1].segment_index} and ${sorted[i].segment_index}` },
          { status: 400 },
        );
      }
    }

    const [artworkRow] = await sql`SELECT id FROM artworks WHERE id = ${id}`;
    if (!artworkRow) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

    // Delete existing segments (cascade deletes texts)
    await sql`DELETE FROM transcript_segments WHERE artwork_id = ${id}`;

    // Insert new segments and zh-TW texts, then auto-translate
    const results = [];
    let translationWarning = false;
    for (const seg of segments) {
      const [segment] = await sql`
        INSERT INTO transcript_segments (artwork_id, segment_index, start_time, end_time)
        VALUES (${id}, ${seg.segment_index}, ${seg.start_time}, ${seg.end_time})
        RETURNING *
      `;

      const [zhText] = await sql`
        INSERT INTO transcript_segment_texts (segment_id, language_code, text, is_reviewed)
        VALUES (${segment.id}, 'zh-TW', ${seg.text}, true)
        RETURNING *
      `;

      // Auto-translate segment text to English (always insert even if Gemini fails)
      const { en, failed } = await translateBoth(seg.text);
      if (failed) translationWarning = true;

      const [enText] = await sql`
        INSERT INTO transcript_segment_texts (segment_id, language_code, text, is_reviewed)
        VALUES (${segment.id}, 'en', ${en ?? ''}, false)
        RETURNING *
      `;

      results.push({ ...segment, texts: [zhText, enText] });
    }

    return NextResponse.json({ data: results, translation_warning: translationWarning }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save segments' }, { status: 500 });
  }
}

// PATCH: update translated texts for a specific language (line N → segment_index N)
// If no segments exist yet, creates them from the provided texts (supports timestamped format).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { language_code, texts } = await req.json() as { language_code: string; texts: string[] };
  if (!Array.isArray(texts)) return NextResponse.json({ error: 'texts array required' }, { status: 400 });

  const segs = await sql`
    SELECT id FROM transcript_segments WHERE artwork_id = ${id} ORDER BY segment_index
  `;

  if (segs.length > 0) {
    // Update existing segment texts
    for (let i = 0; i < segs.length; i++) {
      const text = (texts[i] ?? '').trim();
      await sql`
        UPDATE transcript_segment_texts
        SET text = ${text}, is_reviewed = true
        WHERE segment_id = ${segs[i].id} AND language_code = ${language_code}
      `;
    }
    return NextResponse.json({ data: { updated: segs.length } });
  }

  // No existing segments — create from provided texts
  const nonEmpty = texts.filter(t => t.trim());
  if (nonEmpty.length === 0) return NextResponse.json({ data: { created: 0 } });

  const [artworkRow] = await sql`SELECT id FROM artworks WHERE id = ${id}`;
  if (!artworkRow) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

  // Detect timestamped format: all lines must be "start,end,text"
  const allTimestamped = nonEmpty.every(line => {
    const p = line.split(',');
    return p.length >= 3 && !isNaN(parseFloat(p[0])) && !isNaN(parseFloat(p[1]));
  });

  const inputs = allTimestamped
    ? nonEmpty.map((line, i) => {
        const p = line.split(',');
        return { segment_index: i, start_time: parseFloat(p[0]), end_time: parseFloat(p[1]), text: p.slice(2).join(',').trim() };
      })
    : nonEmpty.map((text, i) => ({ segment_index: i, start_time: i * 10, end_time: (i + 1) * 10, text: text.trim() }));

  let created = 0;
  for (const seg of inputs) {
    const [segment] = await sql`
      INSERT INTO transcript_segments (artwork_id, segment_index, start_time, end_time)
      VALUES (${id}, ${seg.segment_index}, ${seg.start_time}, ${seg.end_time})
      RETURNING *
    `;
    await sql`
      INSERT INTO transcript_segment_texts (segment_id, language_code, text, is_reviewed)
      VALUES (${segment.id}, ${language_code}, ${seg.text}, true)
    `;
    created++;
  }
  return NextResponse.json({ data: { created } }, { status: 201 });
}
