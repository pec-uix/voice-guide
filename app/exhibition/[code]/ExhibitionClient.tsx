'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';
import FeedbackModal, { isFeedbackSubmitted } from '@/components/FeedbackModal';
import GalleryHeader from '@/components/GalleryHeader';
import GalleryFooter from '@/components/GalleryFooter';

interface Exhibition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  review_url: string | null;
  cover_image_url: string | null;
}

interface ArtworkRow {
  id: string;
  code: string;
  cover_image_url: string | null;
  artist: string | null;
  year: string | null;
}

interface TranslationRow {
  artwork_id: string;
  language_code: string;
  title: string;
}

interface Props {
  exhibition: Exhibition;
  artworks: ArtworkRow[];
  translations: TranslationRow[];
  initialLang: LanguageCode;
}

const LANGS = [
  { code: 'zh-TW' as LanguageCode, label: '中文' },
  { code: 'en' as LanguageCode, label: 'EN' },
];

const TRIGGER_KEY = (id: string) => `vg_fb_trigger_${id}`;

export function setFeedbackTrigger(exhibitionId: string) {
  try { localStorage.setItem(TRIGGER_KEY(exhibitionId), '1'); } catch {}
}

export default function ExhibitionClient({ exhibition, artworks, translations, initialLang }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const [showFeedback, setShowFeedback] = useState(false);
  const scanRecorded = useRef(false);
  const pageEntryTime = useRef(Date.now());

  useEffect(() => {
    if (scanRecorded.current) return;
    scanRecorded.current = true;
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibition_id: exhibition.id, event_type: 'scan', language_code: lang }),
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const exId = exhibition.id;
    if (isFeedbackSubmitted(exId)) return;

    const triggerKey = TRIGGER_KEY(exId);
    const hasTrigger = (() => { try { return !!localStorage.getItem(triggerKey); } catch { return false; } })();
    if (hasTrigger) {
      try { localStorage.removeItem(triggerKey); } catch {}
      const timer = setTimeout(() => setShowFeedback(true), 600);
      return () => clearTimeout(timer);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      const elapsed = Date.now() - pageEntryTime.current;
      if (elapsed < 10_000) return;
      if (!isFeedbackSubmitted(exId)) {
        try { localStorage.setItem(triggerKey, '1'); } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [exhibition.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTitle = (artworkId: string) =>
    translations.find((tr) => tr.artwork_id === artworkId && tr.language_code === lang)?.title ??
    translations.find((tr) => tr.artwork_id === artworkId && tr.language_code === 'zh-TW')?.title ??
    artworkId;

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Fixed diagonal gradient background */}
      <div className="fixed inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #ffffff 30%, #d6d6d6 100%)' }} />

      <GalleryHeader lang={lang} onLangChange={setLang} logoHref={`/exhibition/${exhibition.code}?lang=${lang}`} />

      {/* Banner — 1/6 margin on all sides */}
      <div className="px-[8.33%] py-[4%] relative z-10">
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/exhibition/${exhibition.code}/works?lang=${lang}`)}
          onKeyDown={(e) => e.key === 'Enter' && router.push(`/exhibition/${exhibition.code}/works?lang=${lang}`)}
          className="cursor-pointer"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.14), 0 40px 80px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
        <div className="relative overflow-hidden" style={{ aspectRatio: '16/7' }}>
          {exhibition.cover_image_url ? (
            <img
              src={exhibition.cover_image_url}
              alt={exhibition.name}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-stone-300 via-stone-200 to-amber-100" />
          )}
          {/* Gradient overlay at bottom for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Exhibition name overlaid on banner */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 text-white">
            <h1 className="font-serif text-2xl font-bold leading-tight tracking-wide drop-shadow-md">
              {exhibition.name}
            </h1>
            {exhibition.description && (
              <p className="text-white/80 text-sm mt-1 leading-relaxed drop-shadow">
                {exhibition.description}
              </p>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Divider line */}
      <div className="w-full border-t border-gray-200" />

      {/* Works section */}
      <div id="works">
      <div className={`max-w-2xl mx-auto px-6 relative z-10 ${artworks.length > 0 ? 'py-10 pb-24' : ''}`}>
        {artworks.length === 0 ? null : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 mb-14">
            {artworks.map((aw) => (
              <Link
                key={aw.id}
                href={`/artwork/${aw.code}?lang=${lang}`}
                className="group block"
              >
                <div className="w-full overflow-hidden mb-3 rounded-sm shadow-sm" style={{ aspectRatio: '3/4' }}>
                  {aw.cover_image_url ? (
                    <img
                      src={aw.cover_image_url}
                      alt={getTitle(aw.id)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                      <span className="text-stone-300 text-3xl">♪</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-stone-400 mb-1 tracking-wider">
                  {aw.artist ?? ''}
                  {aw.year ? ` · ${aw.year}` : ''}
                </p>
                <p className="text-sm font-medium text-stone-800 leading-snug line-clamp-2 group-hover:text-stone-600 transition-colors">
                  {getTitle(aw.id)}
                </p>
              </Link>
            ))}
          </div>
        )}

      </div>
      </div>

      <GalleryFooter lang={lang} />

      {showFeedback && (
        <FeedbackModal
          exhibitionId={exhibition.id}
          lang={lang}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
