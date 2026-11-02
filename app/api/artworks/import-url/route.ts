import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/verify-auth';
import { parseArtworkFromHtml } from '@/lib/gemini';
import { parseNuxtProductPage } from '@/lib/nuxt-parser';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
        const enTitle = en?.title?.trim() || null;
        // uniart EN pages reuse the Chinese description — don't use it as English
        const enDesc = en?.description && en.description !== zh.description ? en.description : null;
        return NextResponse.json({
          data: {
            title: zh.title,
            title_en: enTitle,
            description: zh.description,
            description_en: enDesc,
            artist: zh.artist,
            cover_image_url: zh.imageUrl || null,
            purchase_url: `https://www.uniart.com.tw/products/${id}`,
            purchase_url_en: `https://www.uniart.com.tw/en/products/${id}`,
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
