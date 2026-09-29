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

      // Auto-translate segment text
      const { en, ja } = await translateBoth(seg.text);
      const otherTexts = [];

      if (en) {
        const [enText] = await sql`
          INSERT INTO transcript_segment_texts (segment_id, language_code, text, is_reviewed)
          VALUES (${segment.id}, 'en', ${en}, false)
          RETURNING *
        `;
        otherTexts.push(enText);
      }
      if (ja) {
        const [jaText] = await sql`
          INSERT INTO transcript_segment_texts (segment_id, language_code, text, is_reviewed)
          VALUES (${segment.id}, 'ja', ${ja}, false)
          RETURNING *
        `;
        otherTexts.push(jaText);
      }

      results.push({ ...segment, texts: [zhText, ...otherTexts] });
    }

    return NextResponse.json({ data: results }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save segments' }, { status: 500 });
  }
}
