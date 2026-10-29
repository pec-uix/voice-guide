import { auth } from '@/auth';
import { db } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const snap = await db.collection('exhibitions').orderBy('created_at', 'desc').get();
    const rows = snap.docs.map(d => d.data());
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

    const existing = await db.collection('exhibitions').where('code', '==', code.trim()).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'Exhibition code already exists' }, { status: 409 });
    }

    const ref = db.collection('exhibitions').doc();
    const row = {
      id: ref.id,
      code: code.trim(),
      name: name.trim(),
      name_en: name_en ?? null,
      description: description ?? null,
      description_en: description_en ?? null,
      review_url: review_url ?? null,
      cover_image_url: cover_image_url ?? null,
      mobile_cover_image_url: mobile_cover_image_url ?? null,
      created_at: new Date().toISOString(),
    };
    await ref.set(row);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 });
  }
}
