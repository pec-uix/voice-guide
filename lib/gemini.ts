const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

function geminiHeaders(apiKey: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
}

export async function translateText(
  text: string,
  targetLang: 'en',
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text.trim()) return null;

  const langName = 'English';
  const prompt = `Translate the following Chinese text to ${langName}. Preserve the literary tone and meaning. Return only the translation with no extra explanation.\n\n${text}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: geminiHeaders(apiKey),
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
}

export async function translateBoth(zhText: string): Promise<TranslationResult> {
  const en = await translateText(zhText, 'en');
  return { en };
}

export interface ImportedArtwork {
  title?: string;
  artist?: string;
  year?: string;
  description?: string;
  cover_image_url?: string;
}

export interface ImportedExhibition {
  name?: string;
  description?: string;
  cover_image_url?: string;
}

async function callGeminiForJson(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: geminiHeaders(apiKey),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    console.error('[gemini] callGeminiForJson error:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

export async function parseArtworkFromHtml(html: string): Promise<ImportedArtwork | null> {
  try {
    const truncated = html.slice(0, 60000);
    const prompt = `從以下 HTML 中提取藝術品資訊，以 JSON 格式回傳。欄位：title（作品名稱）、artist（藝術家名稱）、year（創作年份，字串）、description（作品介紹，盡量完整）、cover_image_url（作品主圖完整絕對網址，必須以 http 開頭）。找不到的欄位設為 null。只回傳 JSON 物件，不要任何 markdown 標記。\n\n${truncated}`;
    return await callGeminiForJson(prompt) as ImportedArtwork;
  } catch {
    return null;
  }
}

export async function parseExhibitionFromHtml(html: string): Promise<ImportedExhibition | null> {
  try {
    const truncated = html.slice(0, 60000);
    const prompt = `從以下 HTML 中提取展覽資訊，以 JSON 格式回傳。欄位：name（展覽名稱）、description（展覽介紹說明，盡量完整）、cover_image_url（展覽主圖完整絕對網址，必須以 http 開頭）。找不到的欄位設為 null。只回傳 JSON 物件，不要任何 markdown 標記。\n\n${truncated}`;
    return await callGeminiForJson(prompt) as ImportedExhibition;
  } catch {
    return null;
  }
}
