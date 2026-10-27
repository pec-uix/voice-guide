'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Artwork, ArtworkTranslation, LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';
import { setFeedbackTrigger } from '@/app/exhibition/[code]/ExhibitionClient';
import GalleryHeader from '@/components/GalleryHeader';
import GalleryFooter from '@/components/GalleryFooter';

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
  exhibitionId?: string;
  exhibitionCode?: string;
  isLastInExhibition?: boolean;
  prevCode?: string;
  nextCode?: string;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ArtworkViewer({ artwork, translations, segments, initialLang, exhibitionId, exhibitionCode, isLastInExhibition, prevCode, nextCode }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const [activeTab, setActiveTab] = useState<'audio' | 'concept'>('audio');

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

  const purchaseUrl = translation?.purchase_url ?? null;

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

  const skip = (sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.max(0, Math.min(duration, audio.currentTime + sec));
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = duration > 0 ? duration - currentTime : 0;
  const logoHref = exhibitionCode ? `/exhibition/${exhibitionCode}?lang=${lang}` : '/';

  /* ── Tab labels ── */
  const tabLabel = (tab: 'audio' | 'concept') =>
    tab === 'audio'
      ? (lang === 'en' ? 'Audio Guide' : '導覽音頻')
      : (lang === 'en' ? 'Artist Statement' : '作品理念');

  /* ── Player block ── */
  const playerBlock = (
    <div>
      {audioUrl ? (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
            onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              recordEvent('complete');
              if (isLastInExhibition && exhibitionId) setFeedbackTrigger(exhibitionId);
            }}
            onError={() => setAudioError(t('audioError', lang))}
            preload="metadata"
          />
          {audioError ? (
            <p className="text-red-400 text-sm">{audioError}</p>
          ) : (
            <div>
              {/* Controls row */}
              <div className="flex items-center gap-3 mb-3">
                {/* Play/Pause */}
                <button onClick={handlePlayPause} aria-label={isPlaying ? t('pause', lang) : t('play', lang)}
                  className="w-12 h-12 flex-shrink-0 flex items-center justify-center border border-stone-800 rounded-full text-stone-800 hover:bg-stone-800 hover:text-white active:scale-95 transition-all">
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
                      <path d="M6 4.75a.75.75 0 0 1 1.18-.61l11 7.25a.75.75 0 0 1 0 1.22l-11 7.25A.75.75 0 0 1 6 19.25V4.75z"/>
                    </svg>
                  )}
                </button>

                {/* Progress bar */}
                <div className="flex-1">
                  <input type="range" className="audio-progress" min={0} max={duration || 100} step={0.1}
                    value={currentTime} onChange={handleSeek}
                    style={{ background: `linear-gradient(to right, #3d2b1f ${progressPercent}%, #e5ddd3 ${progressPercent}%)` }}
                    aria-label={t('audioGuide', lang)}
                  />
                  <div className="flex justify-between text-xs text-stone-400 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-stone-300">-{formatTime(remaining)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-stone-400 text-sm">{t('noAudio', lang)}</p>
      )}
    </div>
  );

  /* ── Transcript ── */
  const transcriptBlock = segments.length > 0 ? (
    <div className="mt-6 space-y-5">
      {segments.map((seg, idx) => {
        const text =
          seg.texts.find((tx) => tx.language_code === lang)?.text ??
          seg.texts.find((tx) => tx.language_code === 'zh-TW')?.text ?? '';
        const isActive = idx === activeIdx;
        return (
          <button key={seg.id} ref={(el) => { segmentRefs.current[idx] = el; }}
            onClick={() => { if (audioRef.current) { audioRef.current.currentTime = seg.start_time; setCurrentTime(seg.start_time); } }}
            className={`w-full text-left bg-transparent border-none p-0 text-base leading-loose cursor-pointer transition-all flex items-start gap-3 ${isActive ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
            aria-label={`跳至 ${formatTime(seg.start_time)}：${text}`}>
            <span className={`mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all ${isActive ? 'bg-violet-600' : 'bg-stone-200'}`} />
            <span className={isActive ? 'font-medium' : ''}>{text}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  /* ── Concept + purchase ── */
  const conceptBlock = (
    <div>
      {translation?.description ? (
        <p className="text-stone-600 leading-loose text-base whitespace-pre-wrap mb-8">
          {translation.description}
        </p>
      ) : (
        <p className="text-stone-400 text-sm">{lang === 'en' ? 'No statement available.' : '尚未提供作品理念。'}</p>
      )}
      {purchaseUrl && (
        <a href={purchaseUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => recordEvent('click_purchase')}
          className="flex items-center justify-center gap-2 w-full bg-violet-600 text-white py-3.5 text-sm font-medium tracking-wider hover:bg-violet-700 transition-colors">
          {t('buy', lang)}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 10a4 4 0 0 1-8 0"/></svg>
        </a>
      )}
    </div>
  );

  /* ── Tab bar ── */
  const tabBar = (
    <div className="flex border-b border-stone-200 mb-6">
      {(['audio', 'concept'] as const).map((tab) => (
        <button key={tab} onClick={() => setActiveTab(tab)}
          className={`px-4 py-2.5 text-base font-medium border-b-2 transition-colors -mb-px ${
            activeTab === tab ? 'border-violet-600 text-violet-700' : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}>
          {tabLabel(tab)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">

      <GalleryHeader lang={lang} onLangChange={handleLangChange} logoHref={logoHref} />

      {/* Floating side buttons */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50">
        {prevCode && (
          <Link href={`/artwork/${prevCode}?lang=${lang}`} aria-label="上一幅"
            className="w-12 h-12 rounded-full bg-stone-800 text-white flex flex-col items-center justify-center shadow-lg hover:bg-stone-600 transition-colors gap-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6"/></svg>
            <span className="text-[9px] tracking-wide leading-none">上一幅</span>
          </Link>
        )}
        {nextCode && (
          <Link href={`/artwork/${nextCode}?lang=${lang}`} aria-label="下一幅"
            className="w-12 h-12 rounded-full bg-stone-800 text-white flex flex-col items-center justify-center shadow-lg hover:bg-stone-600 transition-colors gap-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
            <span className="text-[9px] tracking-wide leading-none">下一幅</span>
          </Link>
        )}
        <button onClick={() => handleLangChange(lang === 'zh-TW' ? 'en' : 'zh-TW')} aria-label="切換語言"
          className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 text-stone-700 flex flex-col items-center justify-center shadow-lg hover:bg-stone-200 transition-colors gap-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span className="text-[9px] tracking-wide leading-none font-medium">
            {lang === 'zh-TW' ? 'EN' : '中文'}
          </span>
        </button>
      </div>

      {/* ── MOBILE ── */}
      <div className="lg:hidden px-5 pt-6 pb-24">
        {/* Image */}
        <div className="rounded-sm shadow-md mb-4 bg-stone-50" style={{ aspectRatio: '3/2' }}>
          {artwork.cover_image_url ? (
            <img src={artwork.cover_image_url} alt={translation?.title ?? artwork.code} className="w-full h-full object-contain"/>
          ) : (
            <div className="w-full h-full flex items-center justify-center"><span className="text-stone-300 text-4xl">♪</span></div>
          )}
        </div>

        {/* Title + artist below image */}
        <div className="mb-6">
          {(artwork.artist || artwork.year) && (
            <p className="text-xs text-stone-400 tracking-widest uppercase mb-1.5">
              {[artwork.artist, artwork.year].filter(Boolean).join(' · ')}
            </p>
          )}
          <h1 className="font-serif text-2xl font-bold text-stone-900 leading-snug">
            {translation?.title ?? artwork.code}
          </h1>
        </div>

        {tabBar}
        {activeTab === 'audio' ? (
          <div>
            {playerBlock}
            {transcriptBlock}
          </div>
        ) : conceptBlock}
      </div>

      {/* ── DESKTOP ── */}
      <main className="hidden lg:block px-6 py-10 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 gap-16 items-start">
          {/* Left: sticky image */}
          <div className="sticky top-8">
            {artwork.cover_image_url ? (
              <img src={artwork.cover_image_url} alt={translation?.title ?? artwork.code}
                className="w-full object-cover shadow-lg" style={{ aspectRatio: '3/4' }}/>
            ) : (
              <div className="w-full bg-stone-100 flex items-center justify-center shadow-lg" style={{ aspectRatio: '3/4' }}>
                <span className="text-stone-300 text-5xl">♪</span>
              </div>
            )}
          </div>

          {/* Right */}
          <div>
            {(artwork.artist || artwork.year) && (
              <p className="text-xs text-stone-400 tracking-widest uppercase mb-3">
                {[artwork.artist, artwork.year].filter(Boolean).join('  ·  ')}
              </p>
            )}
            <h1 className="font-serif text-3xl font-bold text-stone-900 leading-tight mb-8">
              {translation?.title ?? artwork.code}
            </h1>

            {tabBar}

            {activeTab === 'audio' ? (
              <div>
                {playerBlock}
                {transcriptBlock}
              </div>
            ) : conceptBlock}
          </div>
        </div>
      </main>

      <GalleryFooter lang={lang} />
    </div>
  );
}
