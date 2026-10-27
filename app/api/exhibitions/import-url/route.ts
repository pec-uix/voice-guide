import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseExhibitionFromHtml } from '@/lib/gemini';
import { parseNuxtExhibition, parseNuxtProductPage } from '@/lib/nuxt-parser';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
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
    // Derive English URL for uniart topics (insert /en/ before /topics/)
    const enUrl = url.replace(/^(https?:\/\/[^/]+)(\/topics\/)/, '$1/en$2');
    const isUniart = enUrl !== url;

    const [html, enHtmlMaybe] = await Promise.all([
      fetchHtml(url),
      isUniart ? fetchHtml(enUrl) : Promise.resolve(null),
    ]);

    if (!html) {
      return NextResponse.json({ error: '無法取得頁面，請確認網址是否正確' }, { status: 400 });
    }

    // Try Nuxt __NUXT_DATA__ parser first (richer data, no Gemini quota needed)
    const nuxtResult = parseNuxtExhibition(html);
    if (nuxtResult) {
      // Parse English exhibition page for name_en / description_en
      const enResult = enHtmlMaybe ? parseNuxtExhibition(enHtmlMaybe, 'en') : null;
      const name_en = enResult?.exhibition.name ?? null;
      const description_en = enResult?.exhibition.description ?? null;

      // For uniart artworks, fetch English titles in parallel
      const artworksWithEn = await Promise.all(
        nuxtResult.artworks.map(async aw => {
          if (!aw.productId) return { ...aw, title_en: null };
          const enHtml = await fetchHtml(`https://www.uniart.com.tw/en/products/${aw.productId}`);
          const enProduct = enHtml ? parseNuxtProductPage(enHtml) : null;
          return { ...aw, title_en: enProduct?.title ?? null };
        })
      );

      return NextResponse.json({
        data: {
          name: nuxtResult.exhibition.name,
          name_en,
          description: nuxtResult.exhibition.description,
          description_en,
          cover_image_url: nuxtResult.exhibition.coverImageUrl,
          mobile_cover_image_url: nuxtResult.exhibition.mobileCoverImageUrl,
          startDate: nuxtResult.exhibition.startDate,
          endDate: nuxtResult.exhibition.endDate,
          location: nuxtResult.exhibition.location,
          artworks: artworksWithEn,
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
