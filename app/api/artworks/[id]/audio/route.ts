import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { uploadAudio } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const [artwork] = await sql`SELECT id FROM artworks WHERE id = ${id}`;
    if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    if (!file) return NextResponse.json({ error: 'audio file is required' }, { status: 400 });

    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/m4a'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() ?? 'mp3';
    const filename = `artworks/${id}/audio-${Date.now()}.${ext}`;

    const result = await uploadAudio(buffer, filename, file.type);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    const langParam = (formData.get('lang') as string) || 'zh-TW';
    const langCode = langParam === 'en' ? 'en' : 'zh-TW';

    const [translation] = await sql`
      INSERT INTO artwork_translations (artwork_id, language_code, title, audio_url, is_reviewed)
      VALUES (${id}, ${langCode}, '', ${result.url}, ${langCode === 'zh-TW'})
      ON CONFLICT (artwork_id, language_code) DO UPDATE SET
        audio_url = EXCLUDED.audio_url, updated_at = now()
      RETURNING *
    `;

    return NextResponse.json({ data: { audio_url: result.url, translation } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 });
  }
}
