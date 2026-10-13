import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseArtworkFromHtml } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: '請提供網址' }, { status: 400 });
  }

  try {
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) {
      return NextResponse.json({ error: `無法取得頁面（HTTP ${pageRes.status}），該網站可能封鎖了自動擷取` }, { status: 400 });
    }

    const html = await pageRes.text();
    if (html.length < 500) {
      return NextResponse.json({ error: '頁面內容太少，該網站可能需要 JavaScript 才能顯示內容' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 未設定' }, { status: 500 });
    }

    const data = await parseArtworkFromHtml(html);
    if (!data) {
      return NextResponse.json({ error: 'AI 解析失敗，Gemini API 金鑰可能無效或額度用完，請手動填寫' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `連線失敗：${msg}` }, { status: 500 });
  }
}
