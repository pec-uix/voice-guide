import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`
      SELECT * FROM exhibitions ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { code, name, name_en, description, description_en, review_url, cover_image_url, mobile_cover_image_url } = body;

    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO exhibitions (code, name, name_en, description, description_en, review_url, cover_image_url, mobile_cover_image_url)
      VALUES (${code.trim()}, ${name.trim()}, ${name_en ?? null}, ${description ?? null}, ${description_en ?? null}, ${review_url ?? null}, ${cover_image_url ?? null}, ${mobile_cover_image_url ?? null})
      RETURNING *
    `;
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') && msg.includes('code')) {
      return NextResponse.json({ error: 'Exhibition code already exists' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 });
  }
}
