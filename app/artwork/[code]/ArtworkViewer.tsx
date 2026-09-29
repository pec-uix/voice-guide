'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  { code: 'ja' as LanguageCode, label: '日本語' },
];

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ArtworkViewer({ artwork, translations, segments, initialLang }: Props) {
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const scanRecorded = useRef(false);

  const translation =
    translations.find((tr) => tr.language_code === lang) ??
    translations.find((tr) => tr.language_code === 'zh-TW');

  const audioUrl = translations.find((tr) => tr.language_code === 'zh-TW')?.audio_url ?? null;

  // Record scan event once on mount
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

  // Find current active segment
  const activeIdx = segments.findIndex(
    (s) => currentTime >= s.start_time && currentTime < s.end_time,
  );

  // Scroll active segment into view
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
      audio
        .play()
        .then(() => recordEvent('play'))
        .catch(() => {});
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
      <div className="max-w-xl mx-auto px-5 py-8 pb-20">

        {/* Language switcher */}
        <div className="flex gap-2 mb-8">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                lang === l.code
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'text-zinc-500 border-zinc-300 hover:border-zinc-700 hover:text-zinc-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Cover image */}
        {artwork.cover_image_url && (
          <img
            src={artwork.cover_image_url}
            alt={translation?.title ?? artwork.code}
            className="w-full aspect-[4/3] object-cover rounded-xl mb-6"
          />
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold text-zinc-900 leading-tight mb-1">
          {translation?.title ?? artwork.code}
        </h1>

        {/* Artist / Year */}
        {(artwork.artist || artwork.year) && (
          <p className="text-sm text-zinc-500 mb-6">
            {[artwork.artist, artwork.year].filter(Boolean).join('・')}
          </p>
        )}

        {/* Description */}
        {translation?.description && (
          <p className="text-zinc-700 leading-relaxed mb-8 whitespace-pre-wrap text-base">
            {translation.description}
          </p>
        )}

        {/* Audio player */}
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-5 mb-8">
          <p className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wide">
            {t('audioGuide', lang)}
            {lang !== 'zh-TW' && (
              <span className="normal-case ml-1">{t('chineseAudio', lang)}</span>
            )}
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
                <p className="text-red-500 text-sm py-2">{audioError}</p>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Play/Pause button */}
                  <button
                    onClick={handlePlayPause}
                    aria-label={isPlaying ? t('pause', lang) : t('play', lang)}
                    className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-zinc-900 text-white rounded-full shadow-sm active:scale-95 transition-transform"
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M6 4.75a.75.75 0 0 1 1.18-.61l11 7.25a.75.75 0 0 1 0 1.22l-11 7.25A.75.75 0 0 1 6 19.25V4.75z" />
                      </svg>
                    )}
                  </button>

                  {/* Progress */}
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
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-zinc-400 text-sm py-1">{t('noAudio', lang)}</p>
          )}
        </div>

        {/* Transcript */}
        {segments.length > 0 && (
          <section className="mb-10" aria-label={t('transcript', lang)}>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
              {t('transcript', lang)}
            </h2>
            <div className="space-y-4">
              {segments.map((seg, idx) => {
                const text =
                  seg.texts.find((tx) => tx.language_code === lang)?.text ??
                  seg.texts.find((tx) => tx.language_code === 'zh-TW')?.text ??
                  '';
                const isActive = idx === activeIdx;
                return (
                  <p
                    key={seg.id}
                    ref={(el) => { segmentRefs.current[idx] = el; }}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = seg.start_time;
                        setCurrentTime(seg.start_time);
                      }
                    }}
                    className={`text-base leading-relaxed cursor-pointer transition-all ${
                      isActive
                        ? 'text-zinc-900 font-semibold underline decoration-2 underline-offset-4 decoration-zinc-900'
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {text}
                  </p>
                );
              })}
            </div>
          </section>
        )}

        {/* Purchase link — placed after transcript content */}
        {translation?.purchase_url && (
          <a
            href={translation.purchase_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordEvent('click_purchase')}
            className="block w-full text-center bg-zinc-900 text-white py-4 rounded-2xl font-medium text-base active:opacity-80 transition-opacity"
          >
            {t('buy', lang)}
          </a>
        )}
      </div>
    </div>
  );
}
