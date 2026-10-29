import { auth } from '@/auth';
import { db } from '@/lib/firebase-admin';
import { translateBoth } from '@/lib/gemini';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const segsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').orderBy('segment_index').get();
    const rows = await Promise.all(segsSnap.docs.map(async (segDoc) => {
      const seg = segDoc.data();
      const textsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').doc(segDoc.id).collection('texts').get();
      const texts = textsSnap.docs.map(t => ({ language_code: t.id, ...t.data() }));
      return { ...seg, texts };
    }));
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
  }
}

interface SegmentInput {
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const segments: SegmentInput[] = body.segments;

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: 'segments array is required' }, { status: 400 });
    }

    for (const s of segments) {
      if (typeof s.start_time !== 'number' || typeof s.end_time !== 'number') {
        return NextResponse.json({ error: 'start_time and end_time must be numbers' }, { status: 400 });
      }
      if (s.end_time <= s.start_time) {
        return NextResponse.json({ error: `Segment ${s.segment_index}: end_time must be greater than start_time` }, { status: 400 });
      }
    }

    const sorted = [...segments].sort((a, b) => a.start_time - b.start_time);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        return NextResponse.json({ error: `Segments overlap: index ${sorted[i - 1].segment_index} and ${sorted[i].segment_index}` }, { status: 400 });
      }
    }

    const artworkDoc = await db.collection('artworks').doc(id).get();
    if (!artworkDoc.exists) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

    // Delete existing segments
    const existingSegs = await db.collection('artworks').doc(id).collection('transcript_segments').get();
    for (const segDoc of existingSegs.docs) {
      const textsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').doc(segDoc.id).collection('texts').get();
      for (const textDoc of textsSnap.docs) await textDoc.ref.delete();
      await segDoc.ref.delete();
    }

    const results = [];
    let translationWarning = false;
    for (const seg of segments) {
      const segRef = db.collection('artworks').doc(id).collection('transcript_segments').doc();
      const segment = { id: segRef.id, artwork_id: id, segment_index: seg.segment_index, start_time: seg.start_time, end_time: seg.end_time };
      await segRef.set(segment);

      const zhText = { language_code: 'zh-TW', text: seg.text, is_reviewed: true };
      await segRef.collection('texts').doc('zh-TW').set(zhText);

      const { en, failed } = await translateBoth(seg.text);
      if (failed) translationWarning = true;
      const enText = { language_code: 'en', text: en ?? '', is_reviewed: false };
      await segRef.collection('texts').doc('en').set(enText);

      results.push({ ...segment, texts: [zhText, enText] });
    }

    return NextResponse.json({ data: results, translation_warning: translationWarning }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save segments' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { language_code, texts } = await req.json() as { language_code: string; texts: string[] };
  if (!Array.isArray(texts)) return NextResponse.json({ error: 'texts array required' }, { status: 400 });

  const segsSnap = await db.collection('artworks').doc(id).collection('transcript_segments').orderBy('segment_index').get();

  if (segsSnap.size > 0) {
    for (let i = 0; i < segsSnap.docs.length; i++) {
      const text = (texts[i] ?? '').trim();
      await db.collection('artworks').doc(id).collection('transcript_segments').doc(segsSnap.docs[i].id).collection('texts').doc(language_code).set({ text, is_reviewed: true }, { merge: true });
    }
    return NextResponse.json({ data: { updated: segsSnap.size } });
  }

  const nonEmpty = texts.filter(t => t.trim());
  if (nonEmpty.length === 0) return NextResponse.json({ data: { created: 0 } });

  const artworkDoc = await db.collection('artworks').doc(id).get();
  if (!artworkDoc.exists) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

  const allTimestamped = nonEmpty.every(line => {
    const p = line.split(',');
    return p.length >= 3 && !isNaN(parseFloat(p[0])) && !isNaN(parseFloat(p[1]));
  });

  const inputs = allTimestamped
    ? nonEmpty.map((line, i) => { const p = line.split(','); return { segment_index: i, start_time: parseFloat(p[0]), end_time: parseFloat(p[1]), text: p.slice(2).join(',').trim() }; })
    : nonEmpty.map((text, i) => ({ segment_index: i, start_time: i * 10, end_time: (i + 1) * 10, text: text.trim() }));

  let created = 0;
  for (const seg of inputs) {
    const segRef = db.collection('artworks').doc(id).collection('transcript_segments').doc();
    await segRef.set({ id: segRef.id, artwork_id: id, segment_index: seg.segment_index, start_time: seg.start_time, end_time: seg.end_time });
    await segRef.collection('texts').doc(language_code).set({ text: seg.text, is_reviewed: true });
    created++;
  }
  return NextResponse.json({ data: { created } }, { status: 201 });
}
