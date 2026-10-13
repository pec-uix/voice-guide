import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseExhibitionFromHtml } from '@/lib/gemini';
import { parseNuxtExhibition } from '@/lib/nuxt-parser';

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
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!pageRes.ok) {
      return NextResponse.json({ error: '無法取得頁面，請確認網址是否正確' }, { status: 400 });
    }

    const html = await pageRes.text();

    // Try Nuxt __NUXT_DATA__ parser first (richer data, no Gemini quota needed)
    const nuxtResult = parseNuxtExhibition(html);
    if (nuxtResult) {
      return NextResponse.json({
        data: {
          name: nuxtResult.exhibition.name,
          description: nuxtResult.exhibition.description,
          cover_image_url: nuxtResult.exhibition.coverImageUrl,
          startDate: nuxtResult.exhibition.startDate,
          endDate: nuxtResult.exhibition.endDate,
          location: nuxtResult.exhibition.location,
          artworks: nuxtResult.artworks,
        },
      });
    }

    // Fall back to Gemini for non-Nuxt sites
    const data = await parseExhibitionFromHtml(html);
    if (!data) {
      return NextResponse.json({ error: '解析失敗，請手動填寫' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: '無法連線到該網址' }, { status: 500 });
  }
}
