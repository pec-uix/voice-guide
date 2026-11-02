import { requireAdmin } from '@/lib/verify-auth';
import { db } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

async function geminiTranslate(text: string, targetLang: 'en'): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return '';

  const prompt = targetLang === 'en'
    ? `Translate the following Traditional Chinese text to English. Preserve literary tone. Return only the translation, no explanation:\n\n${text}`
    : text;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
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

export async function POST(req: NextRequest, { params }: Params) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const exDoc = await db.collection('exhibitions').doc(id).get();
    if (!exDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ex = exDoc.data()!;

    const [name_en, description_en] = await Promise.all([
      geminiTranslate(ex.name as string, 'en'),
      geminiTranslate((ex.description as string) ?? '', 'en'),
    ]);

    await db.collection('exhibitions').doc(id).update({
      name_en: name_en || null,
      description_en: description_en || null,
    });
    const updatedDoc = await db.collection('exhibitions').doc(id).get();
    return NextResponse.json({ data: updatedDoc.data() });
  } catch (err) {
    console.error('[translate exhibition]', err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
