export interface ParsedExhibition {
  name: string;
  description: string;
  coverImageUrl: string;
  mobileCoverImageUrl: string;
  startDate: string;
  endDate: string;
  location: string;
}

export interface ParsedArtwork {
  productId: number;
  title: string;
  artist: string;
  material: string;
  year: string;
  width: number;
  height: number;
  description: string;
  imageUrl: string;
  purchaseUrl: string;
}

export interface NuxtParseResult {
  exhibition: ParsedExhibition;
  artworks: ParsedArtwork[];
}

function unflatten(arr: unknown[], idx: number, seen = new Map<number, unknown>()): unknown {
  if (seen.has(idx)) return seen.get(idx)!;
  const val = arr[idx];

  if (Array.isArray(val)) {
    if (val.length === 2 && val[0] === 'ShallowReactive') {
      return unflatten(arr, val[1] as number, seen);
    }
    const result: unknown[] = [];
    seen.set(idx, result);
    for (const v of val) {
      result.push(typeof v === 'number' && Number.isInteger(v) ? unflatten(arr, v, seen) : v);
    }
    return result;
  }

  if (val !== null && typeof val === 'object') {
    const result: Record<string, unknown> = {};
    seen.set(idx, result);
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = typeof v === 'number' && Number.isInteger(v) ? unflatten(arr, v, seen) : v;
    }
    return result;
  }

  return val;
}

export interface ParsedProduct {
  title: string;
  description: string;
  artist: string;
  imageUrl: string;
}

export function parseNuxtProductPage(html: string): ParsedProduct | null {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[1].trim()) as unknown[];
    const root = unflatten(arr, 0) as { data: Record<string, unknown> };
    if (!root?.data) return null;

    const first = Object.values(root.data)[0] as Record<string, unknown>;
    if (!first) return null;

    // Chinese pages: productName is directly on the first object
    // English pages: productName is nested under a "product" sub-key
    const product = (first.productName !== undefined
      ? first
      : (first.product as Record<string, unknown>)) ?? first;

    const images = (product.imageUrlArray as string[]) ?? [];
    const imageUrl = images[0]?.replace('/products-thumbnail/', '/products/') ?? '';

    return {
      title: ((product.productName as string) ?? '').trim(),
      description: (product.productDescription as string) ?? '',
      artist: ((product.supplierName as string) ?? '').trim(),
      imageUrl,
    };
  } catch {
    return null;
  }
}

export function parseNuxtExhibition(html: string): NuxtParseResult | null {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;

  try {
    const arr = JSON.parse(match[1].trim()) as unknown[];
    const root = unflatten(arr, 0) as { data: Record<string, Record<string, unknown>> };
    if (!root?.data) return null;

    const ex = Object.values(root.data)[0];
    if (!ex?.exhibitionTitle) return null;

    const products = (ex.relatedProductArray as Record<string, unknown>[]) ?? [];

    const startDate = ((ex.startDate as string) ?? '').split('T')[0];
    const endDate = ((ex.endDate as string) ?? '').split('T')[0];
    const location = (ex.exhibitionLocation as string) ?? '';

    const descParts = [ex.exhibitionDescription as string].filter(Boolean);
    if (location) descParts.unshift(`展覽地點：${location}`);
    if (startDate && endDate) descParts.unshift(`展期：${startDate} ~ ${endDate}`);

    return {
      exhibition: {
        name: (ex.exhibitionTitle as string) ?? '',
        description: descParts.join('\n\n'),
        coverImageUrl: (ex.imageUrlPc as string) ?? '',
        mobileCoverImageUrl: (ex.imageUrlSp as string) ?? (ex.imageUrlPc as string) ?? '',
        startDate,
        endDate,
        location,
      },
      artworks: products.map(p => {
        const size = (p.size as { width: number; height: number }) ?? {};
        const images = (p.imageUrlArray as string[]) ?? [];
        const imageUrl = images[0]?.replace('/products-thumbnail/', '/products/') ?? '';
        const material = ((p.material as string[]) ?? [])[0] ?? '';

        return {
          productId: p.productId as number,
          title: ((p.productName as string) ?? '').trim(),
          artist: (p.supplierName as string) ?? '',
          material,
          year: String(p.years ?? ''),
          width: size.width ?? 0,
          height: size.height ?? 0,
          description: (p.productDescription as string) ?? '',
          imageUrl,
          purchaseUrl: `https://www.uniart.com.tw/products/${p.productId}`,
        };
      }),
    };
  } catch {
    return null;
  }
}
