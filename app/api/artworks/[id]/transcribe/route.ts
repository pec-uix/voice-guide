import { sql } from '@/lib/db';
import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY 未設定' }, { status: 503 });
  }

  const [translation] = await sql`
    SELECT audio_url FROM artwork_translations
    WHERE artwork_id = ${id} AND language_code = 'zh-TW'
  `;
  if (!translation?.audio_url) {
    return NextResponse.json({ error: '請先上傳音檔再進行辨識' }, { status: 400 });
  }

  try {
    const audioRes = await fetch(translation.audio_url);
    if (!audioRes.ok) throw new Error('音檔下載失敗');
    const audioBuffer = await audioRes.arrayBuffer();

    // Detect extension from URL for correct MIME type
    const ext = translation.audio_url.split('.').pop()?.split('?')[0] ?? 'm4a';
    const mimeMap: Record<string, string> = {
      m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
      ogg: 'audio/ogg', webm: 'audio/webm',
    };
    const mimeType = mimeMap[ext] ?? 'audio/mp4';

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioBuffer], `audio.${ext}`, { type: mimeType }),
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      language: 'zh',
    }) as { segments?: Array<{ start: number; end: number; text: string }> };

    const segments = (transcription.segments ?? []).map((s, i) => ({
      segment_index: i,
      start_time: Math.round(s.start * 10) / 10,
      end_time: Math.round(s.end * 10) / 10,
      text: s.text.trim(),
    }));

    return NextResponse.json({ data: segments });
  } catch (err) {
    console.error('Transcribe error:', err);
    return NextResponse.json({ error: '自動辨識失敗，請稍後再試' }, { status: 500 });
  }
}
