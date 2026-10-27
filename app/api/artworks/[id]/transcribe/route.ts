import { auth } from '@/auth';
import { sql } from '@/lib/db';
import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const lang: string = body.lang === 'en' ? 'en' : 'zh-TW';

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY 未設定' }, { status: 503 });
  }

  const [translation] = await sql`
    SELECT audio_url FROM artwork_translations
    WHERE artwork_id = ${id} AND language_code = ${lang}
  `;
  if (!translation?.audio_url) {
    return NextResponse.json({
      error: lang === 'en' ? '請先上傳英文音檔再進行辨識' : '請先上傳音檔再進行辨識',
    }, { status: 400 });
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
      language: lang === 'en' ? 'en' : 'zh',
      ...(lang !== 'en' && { prompt: '以下是繁體中文的藝術導覽內容，請使用繁體中文輸出。' }),
    }) as { segments?: Array<{ start: number; end: number; text: string }> };

    let segments = (transcription.segments ?? []).map((s, i) => ({
      segment_index: i,
      start_time: Math.round(s.start * 10) / 10,
      end_time: Math.round(s.end * 10) / 10,
      text: s.text.trim(),
    }));

    // Whisper outputs Simplified Chinese even with prompting — convert to Traditional via Gemini
    if (lang !== 'en' && process.env.GEMINI_API_KEY && segments.length > 0) {
      try {
        const joined = segments.map(s => s.text).join('\n');
        const prompt = `將以下每一行文字從簡體中文轉換成繁體中文，保持原本的行數與順序，每行只輸出轉換後的繁體中文文字，不要加任何說明或編號：\n${joined}`;
        const res = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const lines = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().split('\n');
          if (lines.length === segments.length) {
            segments = segments.map((s, i) => ({ ...s, text: lines[i].trim() || s.text }));
          }
        }
      } catch {
        // 轉換失敗時保留原始辨識結果
      }
    }

    return NextResponse.json({ data: segments });
  } catch (err) {
    console.error('Transcribe error:', err);
    return NextResponse.json({ error: '自動辨識失敗，請稍後再試' }, { status: 500 });
  }
}
