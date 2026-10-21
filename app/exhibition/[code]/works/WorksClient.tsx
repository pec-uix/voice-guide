'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
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
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const [current, setCurrent] = useState(0);
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

      {/* Carousel */}
      {!hasWorks ? (
        <div className="flex-1 flex items-center justify-center py-32">
          <p className="text-stone-400 text-sm">尚無作品</p>
        </div>
      ) : null}
      <section className={`px-[8.33%] pb-10 relative z-10 ${!hasWorks ? 'hidden' : ''}`}>
        <div
          className="relative overflow-hidden cursor-pointer"
          style={{ aspectRatio: '16/8', boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.14), 0 40px 80px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.08)' }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (dx > 50) handlePrev();
            else if (dx < -50) handleNext();
          }}
        >
          {/* Slides */}
          <div className="flex h-full transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${current * 100}%)`, width: `${artworks.length * 100}%` }}>
            {artworks.map((a) => (
              <Link key={a.id} href={`/artwork/${a.code}?lang=${lang}`} className="relative shrink-0" style={{ width: `${100 / artworks.length}%` }}>
                {a.cover_image_url ? (
                  <img src={a.cover_image_url} alt={getTitle(a.id)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-stone-300 via-stone-200 to-amber-100" />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 text-white">
                  {a.artist && <p className="text-xs tracking-widest text-white/70 mb-1">{a.artist}{a.year ? ` · ${a.year}` : ''}</p>}
                  <p className="font-serif text-xl font-bold drop-shadow-md">{getTitle(a.id)}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Arrows */}
          {artworks.length > 1 && (
            <>
              <button onClick={handlePrev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 hover:bg-white flex items-center justify-center shadow transition-colors z-10" aria-label="上一件">
                <svg className="w-4 h-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <button onClick={handleNext} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/70 hover:bg-white flex items-center justify-center shadow transition-colors z-10" aria-label="下一件">
                <svg className="w-4 h-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </>
          )}

          {/* Dots */}
          {artworks.length > 1 && (
            <div className="absolute bottom-3 right-0 left-0 flex justify-center gap-1.5 z-10">
              {artworks.map((_, i) => (
                <button key={i} onClick={() => { setCurrent(i); resetAutoPlay(); }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/50'}`}
                  aria-label={`第 ${i + 1} 件`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* All works grid */}
      <section id="all-works" className={`px-6 pb-20 relative z-10 ${!hasWorks ? 'hidden' : ''}`}>
        <p className="text-xs text-stone-400 tracking-[0.2em] uppercase mb-6 text-center">
          {lang === 'en' ? 'All Works' : '所有作品'}
        </p>
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-x-5 gap-y-10">
          {artworks.map((a) => (
            <Link key={a.id} href={`/artwork/${a.code}?lang=${lang}`} className="group block">
              <div className="w-full overflow-hidden mb-3 rounded-sm shadow-sm" style={{ aspectRatio: '3/4' }}>
                {a.cover_image_url ? (
                  <img src={a.cover_image_url} alt={getTitle(a.id)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                    <span className="text-stone-300 text-3xl">♪</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-400 mb-1 tracking-wider">{a.artist ?? ''}{a.year ? ` · ${a.year}` : ''}</p>
              <p className="text-sm font-medium text-stone-800 leading-snug line-clamp-2 group-hover:text-stone-600 transition-colors">{getTitle(a.id)}</p>
            </Link>
          ))}
        </div>
      </section>

      <GalleryFooter lang={lang} />
    </div>
  );
}
