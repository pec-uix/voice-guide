'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Artwork, ArtworkTranslation, LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';

interface SegmentWithTexts {
  id: string;
  segment_index: number;
  start_time: number;
  end_time: number;
  texts: { language_code: string; text: string }[];
}

interface Props {
  artwork: Artwork;
  translations: ArtworkTranslation[];
  segments: SegmentWithTexts[];
  initialLang: LanguageCode;
}

const LANGS = [
  { code: 'zh-TW' as LanguageCode, label: '中文' },
  { code: 'en' as LanguageCode, label: 'EN' },
];

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ArtworkViewer({ artwork, translations, segments, initialLang }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<LanguageCode>(initialLang);

  const handleLangChange = (newLang: LanguageCode) => {
    setLang(newLang);
    router.replace(`?lang=${newLang}`, { scroll: false });
  };
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scanRecorded = useRef(false);

  const translation =
    translations.find((tr) => tr.language_code === lang) ??
    translations.find((tr) => tr.language_code === 'zh-TW');

  const audioUrl =
    translations.find((tr) => tr.language_code === lang)?.audio_url ??
    translations.find((tr) => tr.language_code === 'zh-TW')?.audio_url ??
    null;

  useEffect(() => {
    if (scanRecorded.current) return;
    scanRecorded.current = true;
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artwork_id: artwork.id, event_type: 'scan', language_code: lang }),
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const recordEvent = useCallback(
    (eventType: string) => {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artwork_id: artwork.id, event_type: eventType, language_code: lang }),
      }).catch(() => {});
    },
    [artwork.id, lang],
  );

  const activeIdx = segments.findIndex(
    (s) => currentTime >= s.start_time && currentTime < s.end_time,
  );

  useEffect(() => {
    if (activeIdx >= 0) {
      segmentRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIdx]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      recordEvent('pause');
    } else {
      audio.play().then(() => recordEvent('play')).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = Number(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-white">

      {/* Cover image — full bleed, no padding */}
      {artwork.cover_image_url ? (
        <div className="w-full overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <img
            src={artwork.cover_image_url}
            alt={translation?.title ?? artwork.code}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full bg-zinc-100 flex items-center justify-center" style={{ aspectRatio: '4/3' }}>
          <span className="text-zinc-300 text-5xl">♪</span>
        </div>
      )}

      <div className="max-w-xl mx-auto px-6 pt-8 pb-24">

        {/* Language switcher — text style */}
        <div className="flex justify-end gap-4 mb-8">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => handleLangChange(l.code)}
              className={`text-xs tracking-wider transition-colors pb-0.5 ${
                lang === l.code
                  ? 'text-zinc-900 border-b border-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Artist / Year */}
        {(artwork.artist || artwork.year) && (
          <p className="text-xs text-zinc-400 tracking-widest uppercase mb-3">
            {[artwork.artist, artwork.year].filter(Boolean).join('  ·  ')}
          </p>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold text-zinc-900 leading-tight mb-8">
          {translation?.title ?? artwork.code}
        </h1>

        {/* Description */}
        {translation?.description && (
          <p className="text-zinc-600 leading-loose text-base whitespace-pre-wrap mb-10">
            {translation.description}
          </p>
        )}

        <div className="border-t border-zinc-100 mb-8" />

        {/* Audio player */}
        <div className="mb-10">
          <p className="text-xs text-zinc-400 tracking-widest uppercase mb-5">
            {t('audioGuide', lang)}
          </p>

          {audioUrl ? (
            <>
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); recordEvent('complete'); }}
                onError={() => setAudioError(t('audioError', lang))}
                preload="metadata"
              />
              {audioError ? (
                <p className="text-red-400 text-sm">{audioError}</p>
              ) : (
                <div className="flex items-center gap-5">
                  {/* Play/Pause — outline circle */}
                  <button
                    onClick={handlePlayPause}
                    aria-label={isPlaying ? t('pause', lang) : t('play', lang)}
                    className="w-14 h-14 flex-shrink-0 flex items-center justify-center border border-zinc-900 rounded-full text-zinc-900 hover:bg-zinc-900 hover:text-white active:scale-95 transition-all"
                  >
                    {isPlaying ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ marginLeft: 2 }}>
                        <path d="M6 4.75a.75.75 0 0 1 1.18-.61l11 7.25a.75.75 0 0 1 0 1.22l-11 7.25A.75.75 0 0 1 6 19.25V4.75z" />
                      </svg>
                    )}
                  </button>

                  {/* Progress bar */}
                  <div className="flex-1">
                    <input
                      type="range"
                      className="audio-progress"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      style={{
                        background: `linear-gradient(to right, #18181b ${progressPercent}%, #e4e4e7 ${progressPercent}%)`,
                      }}
                      aria-label={t('audioGuide', lang)}
                    />
                    <div className="flex justify-between text-xs text-zinc-400 mt-1.5">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-zinc-400 text-sm">{t('noAudio', lang)}</p>
          )}
        </div>

        {/* Transcript */}
        {segments.length > 0 && (
          <section className="mb-12" aria-label={t('transcript', lang)}>
            <h2 className="text-xs text-zinc-400 tracking-widest uppercase mb-6">
              {t('transcript', lang)}
            </h2>
            <div className="space-y-5">
              {segments.map((seg, idx) => {
                const text =
                  seg.texts.find((tx) => tx.language_code === lang)?.text ??
                  seg.texts.find((tx) => tx.language_code === 'zh-TW')?.text ??
                  '';
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={seg.id}
                    ref={(el) => { segmentRefs.current[idx] = el; }}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = seg.start_time;
                        setCurrentTime(seg.start_time);
                      }
                    }}
                    className={`w-full text-left bg-transparent border-none p-0 text-base leading-loose cursor-pointer transition-all flex items-start gap-3 ${
                      isActive ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                    aria-label={`跳至 ${formatTime(seg.start_time)}：${text}`}
                  >
                    <span className={`mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${
                      isActive ? 'bg-zinc-900' : 'bg-zinc-200'
                    }`} />
                    <span className={isActive ? 'font-medium' : ''}>{text}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Purchase link — outline button */}
        {translation?.purchase_url && (
          <a
            href={translation.purchase_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordEvent('click_purchase')}
            className="block w-full text-center border border-zinc-900 text-zinc-900 py-4 text-sm font-medium tracking-wider hover:bg-zinc-900 hover:text-white transition-colors"
          >
            {t('buy', lang)} ↗
          </a>
        )}
      </div>
    </div>
  );
}
