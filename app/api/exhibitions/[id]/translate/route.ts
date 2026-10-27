import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

async function geminiTranslate(text: string, targetLang: 'en'): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return '';

  const prompt = targetLang === 'en'
    ? `Translate the following Traditional Chinese text to English. Preserve literary tone. Return only the translation, no explanation:\n\n${text}`
    : text;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const [ex] = await sql`SELECT * FROM exhibitions WHERE id = ${id}`;
    if (!ex) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [name_en, description_en] = await Promise.all([
      geminiTranslate(ex.name as string, 'en'),
      geminiTranslate((ex.description as string) ?? '', 'en'),
    ]);

    const [row] = await sql`
      UPDATE exhibitions
      SET name_en = ${name_en || null}, description_en = ${description_en || null}
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[translate exhibition]', err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
