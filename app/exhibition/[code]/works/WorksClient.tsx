'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LanguageCode } from '@/lib/types';
import GalleryHeader from '@/components/GalleryHeader';
import GalleryFooter from '@/components/GalleryFooter';

interface Exhibition { id: string; code: string; name: string; }
interface ArtworkRow { id: string; code: string; cover_image_url: string | null; artist: string | null; year: string | null; }
interface TranslationRow { artwork_id: string; language_code: string; title: string; }

interface Props {
  exhibition: Exhibition;
  artworks: ArtworkRow[];
  translations: TranslationRow[];
  initialLang: LanguageCode;
}

export default function WorksClient({ exhibition, artworks, translations, initialLang }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const [current, setCurrent] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const touchStartX = useRef(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getTitle = useCallback((artworkId: string) =>
    translations.find(t => t.artwork_id === artworkId && t.language_code === lang)?.title ??
    translations.find(t => t.artwork_id === artworkId && t.language_code === 'zh-TW')?.title ?? '',
  [translations, lang]);

  const prev = useCallback(() => setCurrent(i => (i - 1 + artworks.length) % artworks.length), [artworks.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % artworks.length), [artworks.length]);

  const resetAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(next, 4500);
  }, [next]);

  useEffect(() => {
    if (artworks.length <= 1) return;
    resetAutoPlay();
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [artworks.length, resetAutoPlay]);

  const handlePrev = () => { prev(); resetAutoPlay(); };
  const handleNext = () => { next(); resetAutoPlay(); };

  const hasWorks = artworks.length > 0;

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #ffffff 30%, #d6d6d6 100%)' }}>
      <div className="fixed inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #ffffff 30%, #d6d6d6 100%)' }} />

      <GalleryHeader lang={lang} onLangChange={setLang} logoHref={`/exhibition/${exhibition.code}?lang=${lang}`} />

      {!hasWorks ? (
        <div className="flex-1 flex items-center justify-center py-32">
          <p className="text-stone-400 text-sm">尚無作品</p>
        </div>
      ) : null}

      {/* Coverflow carousel */}
      <section className={`px-[8.33%] pb-10 relative z-10 ${!hasWorks ? 'hidden' : ''}`}>
        <div
          className="relative overflow-hidden"
          style={{
            aspectRatio: '12/5',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.14), 0 40px 80px rgba(0,0,0,0.10)',
            border: '1px solid rgba(0,0,0,0.08)',
            background: '#111',
          }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (dx > 50) handlePrev();
            else if (dx < -50) handleNext();
          }}
        >
          {artworks.map((a, i) => {
            const offset = ((i - current + artworks.length) % artworks.length);
            const norm = offset > artworks.length / 2 ? offset - artworks.length : offset;
            const isCenter = norm === 0;
            const isLeft = norm === -1;
            const isRight = norm === 1;
            const isVisible = Math.abs(norm) <= 1;

            let leftPct: number;
            if (isCenter) leftPct = 22;
            else if (isLeft) leftPct = 0;
            else if (isRight) leftPct = 78;
            else if (norm < 0) leftPct = -22;
            else leftPct = 100;

            const widthPct = isCenter ? 56 : 22;

            return (
              <div
                key={a.id}
                className="absolute overflow-hidden cursor-pointer"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 0,
                  bottom: 0,
                  opacity: isVisible ? 1 : 0,
                  transition: 'left 500ms ease-in-out, width 500ms ease-in-out, opacity 400ms ease-in-out',
                  zIndex: isCenter ? 3 : isVisible ? 2 : 1,
                }}
                onClick={() => {
                  if (isCenter) router.push(`/artwork/${a.code}?lang=${lang}`);
                  else if (isLeft) handlePrev();
                  else if (isRight) handleNext();
                }}
              >
                {a.cover_image_url ? (
                  <img src={a.cover_image_url} alt={getTitle(a.id)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-stone-300 via-stone-200 to-amber-100" />
                )}
                {!isCenter && <div className="absolute inset-0 bg-black/40" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div
                  className="absolute bottom-0 left-0 right-0 px-4 pb-4 text-white"
                  style={{ opacity: isCenter ? 1 : 0, transition: 'opacity 400ms' }}
                >
                  {a.artist && <p className="text-xs tracking-widest text-white/70 mb-1">{a.artist}{a.year ? ` · ${a.year}` : ''}</p>}
                  <p className="font-serif text-lg font-bold drop-shadow-md">{getTitle(a.id)}</p>
                </div>
              </div>
            );
          })}

          {artworks.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 flex items-center justify-center shadow transition-colors z-10"
                aria-label="上一件"
              >
                <svg className="w-4 h-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleNext(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/60 hover:bg-white/90 flex items-center justify-center shadow transition-colors z-10"
                aria-label="下一件"
              >
                <svg className="w-4 h-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

        </div>
      </section>

      {/* All works */}
      <section id="all-works" className={`px-[8.33%] pb-20 relative z-10 ${!hasWorks ? 'hidden' : ''}`}>
        {/* Header + view toggle */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-stone-400 tracking-[0.2em] uppercase">
            {lang === 'en' ? 'All Works' : '所有作品'}
          </p>
          <div className="flex gap-1 border border-stone-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-violet-600 text-white' : 'text-stone-400 hover:text-stone-600'}`}
              aria-label="圖片檢視"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-stone-400 hover:text-stone-600'}`}
              aria-label="列表檢視"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Grid view */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {artworks.map((a) => (
              <Link key={a.id} href={`/artwork/${a.code}?lang=${lang}`} className="group block">
                <div className="w-full overflow-hidden rounded-sm shadow-sm" style={{ aspectRatio: '3/4' }}>
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt={getTitle(a.id)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                      <span className="text-stone-300 text-3xl">♪</span>
                    </div>
                  )}
                </div>
                <div className="mt-2.5 px-0.5">
                  <p className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2 group-hover:text-stone-500 transition-colors mb-1">
                    {getTitle(a.id)}
                  </p>
                  <p className="text-xs text-stone-400 tracking-wide">
                    {a.artist ?? ''}{a.year ? <span className="text-stone-300"> · </span> : null}{a.year ?? ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* List view */}
        {viewMode === 'list' && (
          <div className="divide-y divide-stone-100">
            {artworks.map((a, idx) => (
              <Link key={a.id} href={`/artwork/${a.code}?lang=${lang}`}
                className="flex items-center gap-4 lg:gap-6 py-4 lg:py-6 group hover:bg-stone-50 -mx-3 px-3 rounded-sm transition-colors">
                <span className="text-xs lg:text-sm text-stone-300 w-6 lg:w-8 text-right flex-shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                <div className="w-10 h-10 lg:w-16 lg:h-16 flex-shrink-0 overflow-hidden rounded-sm bg-stone-100">
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-stone-300 text-xs">♪</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm lg:text-lg font-medium text-stone-800 group-hover:text-stone-500 transition-colors truncate">
                    {getTitle(a.id)}
                  </p>
                  <p className="text-xs lg:text-sm text-stone-400 mt-0.5 lg:mt-1">
                    {a.artist ?? ''}{a.year ? ` · ${a.year}` : ''}
                  </p>
                </div>
                <svg className="w-4 h-4 lg:w-5 lg:h-5 text-stone-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>

      <GalleryFooter lang={lang} />
    </div>
  );
}
