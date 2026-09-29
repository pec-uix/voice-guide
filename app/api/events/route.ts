import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const VALID_EVENT_TYPES = ['scan', 'play', 'pause', 'complete', 'click_purchase', 'click_review'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { artwork_id, exhibition_id, language_code, event_type, source } = body;

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json(
        { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!artwork_id && !exhibition_id) {
      return NextResponse.json(
        { error: 'artwork_id or exhibition_id is required' },
        { status: 400 },
      );
    }

    const [row] = await sql`
      INSERT INTO events (artwork_id, exhibition_id, language_code, event_type, source)
      VALUES (
        ${artwork_id ?? null},
        ${exhibition_id ?? null},
        ${language_code ?? null},
        ${event_type},
        ${source ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
}
