import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { uploadAudio } from '@/lib/storage';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

// Google Translate TTS fallback — free, no key, simpler voice quality
async function gTranslateTTS(text: string, lang: string): Promise<Buffer> {
  const tl = lang === 'en' ? 'en' : 'zh-TW';
  const MAX = 180;

  // Ensure each line ends with punctuation so TTS produces a natural pause between segments
  const lines = text.split('\n').filter(l => l.trim()).map(line => {
    line = line.trim();
    if (!/[。！？.!?,，]$/.test(line)) line += lang === 'en' ? '.' : '。';
    return line;
  });

  // Chunk into ≤180-char requests, keeping lines together
  const chunks: string[] = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + line).length > MAX && cur) { chunks.push(cur); cur = line; }
    else cur += cur ? ' ' + line : line;
  }
  if (cur) chunks.push(cur);

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${tl}&client=gtx`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });
    if (!res.ok) throw new Error(`Google TTS: ${res.status}`);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}

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
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}"><voice name="${selectedVoice}">${segments.join('<break time="600ms"/>')}</voice></speak>`;

    // Try Edge TTS (neural quality) with up to 3 retries on transient errors
    let buffer: Buffer | null = null;
    let usedFallback = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(ssml);
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          audioStream.on('end', resolve);
          audioStream.on('error', reject);
        });
        buffer = Buffer.concat(chunks);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Edge TTS uses https.request which isn't available in Cloudflare Workers
        if (msg.includes('not implemented')) {
          console.warn('Edge TTS not supported in this runtime, falling back to Google Translate TTS');
          buffer = await gTranslateTTS(text.trim(), langCode);
          usedFallback = true;
          break;
        }
        const isRetryable = msg.includes('429') || msg.includes('truncated') || msg.includes('Stream closed');
        if (!isRetryable) throw err;
        if (attempt === 2) {
          console.warn('Edge TTS exhausted retries, falling back to Google Translate TTS');
          buffer = await gTranslateTTS(text.trim(), langCode);
          usedFallback = true;
        }
      }
    }
    if (!buffer) throw new Error('TTS buffer empty');

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

    return NextResponse.json({ data: { audio_url: result.url, translation, fallback: usedFallback } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('TTS error:', err);
    return NextResponse.json({ error: `音檔產生失敗：${msg}` }, { status: 500 });
  }
}
