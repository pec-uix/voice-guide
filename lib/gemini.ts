const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function translateText(
  text: string,
  targetLang: 'en' | 'ja',
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return null;

  const langName = targetLang === 'en' ? 'English' : 'Japanese';
  const prompt = `Translate the following Chinese text to ${langName}. Preserve the literary tone and meaning. Return only the translation with no extra explanation.\n\n${text}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });

    if (!res.ok) {
      console.error('[gemini] HTTP error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (err) {
    console.error('[gemini] fetch error:', err);
    return null;
  }
}

export interface TranslationResult {
  en: string | null;
  ja: string | null;
}

export async function translateBoth(zhText: string): Promise<TranslationResult> {
  const [en, ja] = await Promise.all([
    translateText(zhText, 'en'),
    translateText(zhText, 'ja'),
  ]);
  return { en, ja };
}
