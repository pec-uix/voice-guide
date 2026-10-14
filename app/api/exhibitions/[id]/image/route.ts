import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { uploadImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const [exhibition] = await sql`SELECT id FROM exhibitions WHERE id = ${id}`;
    if (!exhibition) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'image file is required' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `exhibitions/${id}/cover-${Date.now()}.${ext}`;

    const result = await uploadImage(buffer, filename);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    const [row] = await sql`
      UPDATE exhibitions SET cover_image_url = ${result.url} WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json({ data: { cover_image_url: result.url, exhibition: row } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
