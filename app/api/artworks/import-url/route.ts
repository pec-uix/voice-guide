import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseArtworkFromHtml, translateText } from '@/lib/gemini';
import { parseNuxtProductPage } from '@/lib/nuxt-parser';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'zh-TW,en;q=0.8' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: '請提供網址' }, { status: 400 });
  }

  try {
    // Detect uniart product pages and fetch both Chinese + English versions in parallel
    const uniartMatch = url.match(/uniart\.com\.tw(?:\/en)?\/products\/(\d+)/);
    if (uniartMatch) {
      const id = uniartMatch[1];
      const [zhHtml, enHtml] = await Promise.all([
        fetchHtml(`https://www.uniart.com.tw/products/${id}`),
        fetchHtml(`https://www.uniart.com.tw/en/products/${id}`),
      ]);
      const zh = zhHtml ? parseNuxtProductPage(zhHtml) : null;
      const en = enHtml ? parseNuxtProductPage(enHtml) : null;
      if (zh) {
        // Use English page content if available, otherwise fall back to Gemini translation
        const titleEn = en?.title?.trim() || (await translateText(zh.title, 'en'));
        const descEn = en?.description?.trim() || (zh.description ? await translateText(zh.description, 'en') : null);
        return NextResponse.json({
          data: {
            title: zh.title,
            title_en: titleEn ?? null,
            description: zh.description,
            description_en: descEn ?? null,
            artist: zh.artist,
            cover_image_url: zh.imageUrl || null,
            purchase_url: `https://www.uniart.com.tw/products/${id}`,
          },
        });
      }
    }

    const html = await fetchHtml(url);
    if (!html) return NextResponse.json({ error: '無法取得頁面，該網站可能封鎖了自動擷取' }, { status: 400 });
    if (html.length < 500) return NextResponse.json({ error: '頁面內容太少，該網站可能需要 JavaScript 才能顯示內容' }, { status: 400 });

    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY 未設定' }, { status: 500 });

    const data = await parseArtworkFromHtml(html);
    if (!data) return NextResponse.json({ error: 'AI 解析失敗，請手動填寫' }, { status: 500 });

    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `連線失敗：${msg}` }, { status: 500 });
  }
}
