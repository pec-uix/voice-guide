import { requireAdmin } from '@/lib/verify-auth';
import { db } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const lang: string = body.lang === 'en' ? 'en' : 'zh-TW';

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 未設定' }, { status: 503 });
  }

  const translationDoc = await db.collection('artworks').doc(id).collection('translations').doc(lang).get();
  const translation = translationDoc.exists ? translationDoc.data() : null;
  if (!translation?.audio_url) {
    return NextResponse.json({
      error: lang === 'en' ? '請先上傳英文音檔再進行辨識' : '請先上傳音檔再進行辨識',
    }, { status: 400 });
  }

  try {
    const audioUrl = translation.audio_url as string;
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error('音檔下載失敗');
    const audioBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    const ext = audioUrl.split('.').pop()?.split('?')[0] ?? 'm4a';
    const mimeMap: Record<string, string> = {
      m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
      ogg: 'audio/ogg', webm: 'audio/webm',
    };
    const mimeType = mimeMap[ext] ?? 'audio/mp4';

    const prompt = lang === 'en'
      ? 'Transcribe this audio in English. Return ONLY a JSON array, no other text:\n[{"start": 0.0, "end": 3.5, "text": "sentence"}]'
      : '請將這段音檔逐字轉錄成繁體中文，標記每個句子的開始和結束時間（秒數）。只輸出以下格式的JSON陣列，不要其他說明：\n[{"start": 0.0, "end": 3.5, "text": "繁體中文文字"}]';

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: prompt },
          ]}],
          generationConfig: { temperature: 0 },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini API error: ${await res.text()}`);
    const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('無法解析 Gemini 回傳的格式');

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ start: number; end: number; text: string }>;
    const segments = parsed.map((s, i) => ({
      segment_index: i,
      start_time: Math.round(s.start * 10) / 10,
      end_time: Math.round(s.end * 10) / 10,
      text: s.text.trim(),
    }));

    return NextResponse.json({ data: segments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Transcribe error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
