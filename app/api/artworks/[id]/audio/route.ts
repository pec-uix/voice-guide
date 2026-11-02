import { requireAdmin } from '@/lib/verify-auth';
import { db } from '@/lib/firebase-admin';
import { uploadAudio } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const artworkDoc = await db.collection('artworks').doc(id).get();
    if (!artworkDoc.exists) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('audio') as File | null;
    if (!file) return NextResponse.json({ error: 'audio file is required' }, { status: 400 });

    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/m4a'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() ?? 'mp3';
    const filename = `artworks/${id}/audio-${Date.now()}.${ext}`;

    const result = await uploadAudio(buffer, filename, file.type);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    const langParam = (formData.get('lang') as string) || 'zh-TW';
    const langCode = langParam === 'en' ? 'en' : 'zh-TW';
    const now = new Date().toISOString();
    const translationRef = db.collection('artworks').doc(id).collection('translations').doc(langCode);
    const existingDoc = await translationRef.get();
    if (existingDoc.exists) {
      await translationRef.update({ audio_url: result.url, updated_at: now });
    } else {
      await translationRef.set({ title: '', description: null, purchase_url: null, audio_url: result.url, is_reviewed: langCode === 'zh-TW', created_at: now, updated_at: now });
    }
    const translation = (await translationRef.get()).data();

    return NextResponse.json({ data: { audio_url: result.url, translation } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 });
  }
}
