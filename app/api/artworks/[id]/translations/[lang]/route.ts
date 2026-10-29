import { auth } from '@/auth';
import { db } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { LANGUAGE_CODES } from '@/lib/types';

type Params = { params: Promise<{ id: string; lang: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, lang } = await params;
  if (!LANGUAGE_CODES.includes(lang as never)) {
    return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
  }
  try {
    const doc = await db.collection('artworks').doc(id).collection('translations').doc(lang).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: { language_code: doc.id, ...doc.data() } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch translation' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, lang } = await params;
  if (!LANGUAGE_CODES.includes(lang as never)) {
    return NextResponse.json({ error: 'Invalid language code' }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { title, description, purchase_url, audio_url, is_reviewed } = body;

    const ref = db.collection('artworks').doc(id).collection('translations').doc(lang);
    const existing = await ref.get();
    const now = new Date().toISOString();

    const update: Record<string, unknown> = { updated_at: now };
    if (title !== undefined) update.title = title ?? '';
    if (description !== undefined) update.description = description ?? null;
    if (purchase_url !== undefined) update.purchase_url = purchase_url ?? null;
    if (audio_url !== undefined) update.audio_url = audio_url ?? null;
    if (is_reviewed !== undefined) update.is_reviewed = is_reviewed ?? false;

    if (!existing.exists) {
      update.created_at = now;
      if (!('title' in update)) update.title = '';
      if (!('is_reviewed' in update)) update.is_reviewed = false;
    }

    await ref.set(update, { merge: true });
    const updated = await ref.get();
    return NextResponse.json({ data: { language_code: lang, ...updated.data() } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update translation' }, { status: 500 });
  }
}
