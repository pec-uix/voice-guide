import { requireAdmin } from '@/lib/verify-auth';
import { db } from '@/lib/firebase-admin';
import { uploadImage } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const exhibitionDoc = await db.collection('exhibitions').doc(id).get();
    if (!exhibitionDoc.exists) return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 });

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

    await db.collection('exhibitions').doc(id).update({ cover_image_url: result.url });
    const updatedDoc = await db.collection('exhibitions').doc(id).get();
    return NextResponse.json({ data: { cover_image_url: result.url, exhibition: updatedDoc.data() } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
