import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { uploadAudio } from '@/lib/storage';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const body = await req.json();
  const { text, voice, lang } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: '請輸入逐字稿文字' }, { status: 400 });
  }

  const langCode = lang === 'en' ? 'en' : 'zh-TW';
  const ZH_VOICES = ['zh-TW-HsiaoChenNeural', 'zh-TW-HsiaoYuNeural', 'zh-TW-YunJheNeural'];
  const EN_VOICES = ['en-US-JennyNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural'];
  const ALL_VOICES = [...ZH_VOICES, ...EN_VOICES];
  const defaultVoice = langCode === 'en' ? 'en-US-JennyNeural' : 'zh-TW-HsiaoChenNeural';
  const selectedVoice = ALL_VOICES.includes(voice) ? voice : defaultVoice;
  const xmlLang = selectedVoice.startsWith('en-US') ? 'en-US' : selectedVoice.startsWith('en-GB') ? 'en-GB' : 'zh-TW';

  const [artwork] = await sql`SELECT id FROM artworks WHERE id = ${id}`;
  if (!artwork) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });

  try {
    const segments = text.trim().split('\n').filter((s: string) => s.trim());
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}"><voice name="${selectedVoice}">${segments.join('<break time="2500ms"/>')}</voice></speak>`;

    const tts = new MsEdgeTTS();
    await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(ssml);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);

    const filename = `artworks/${id}/audio-${Date.now()}.mp3`;
    const result = await uploadAudio(buffer, filename, 'audio/mpeg');
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    const [translation] = await sql`
      INSERT INTO artwork_translations (artwork_id, language_code, title, audio_url, is_reviewed)
      VALUES (${id}, ${langCode}, '', ${result.url}, ${langCode === 'zh-TW'})
      ON CONFLICT (artwork_id, language_code) DO UPDATE SET
        audio_url = EXCLUDED.audio_url, updated_at = now()
      RETURNING *
    `;

    return NextResponse.json({ data: { audio_url: result.url, translation } });
  } catch (err) {
    console.error('TTS error:', err);
    return NextResponse.json({ error: '音檔產生失敗，請稍後再試' }, { status: 500 });
  }
}
