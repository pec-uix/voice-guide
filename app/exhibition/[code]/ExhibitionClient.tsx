'use client';

import { useState, useEffect, useRef } from 'react';
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
  mobile_cover_image_url: string | null;
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

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Fixed diagonal gradient background */}
      <div className="fixed inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #ffffff 30%, #d6d6d6 100%)' }} />

      <GalleryHeader lang={lang} onLangChange={setLang} logoHref={`/exhibition/${exhibition.code}?lang=${lang}`} />

      {/* Banner */}
      <div className="px-[8.33%] pt-[4%] relative z-10">
        <div
          className="overflow-hidden"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.14), 0 40px 80px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          <div className="relative lg:aspect-[16/7]">
            {(exhibition.cover_image_url || exhibition.mobile_cover_image_url) ? (
              <>
                <picture className="block lg:absolute lg:inset-0 lg:w-full lg:h-full">
                  {exhibition.mobile_cover_image_url && (
                    <source media="(max-width: 1023px)" srcSet={exhibition.mobile_cover_image_url} />
                  )}
                  <img
                    src={exhibition.cover_image_url ?? exhibition.mobile_cover_image_url ?? ''}
                    alt={exhibition.name}
                    className="w-full h-auto lg:h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                  />
                </picture>
                {/* Name at bottom of banner */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 text-white">
                  <h1 className="font-serif text-2xl lg:text-3xl font-bold leading-tight tracking-wide" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
                    {exhibition.name}
                  </h1>
                </div>
              </>
            ) : (
              <div className="aspect-[3/4] lg:absolute lg:inset-0 bg-gradient-to-br from-stone-300 via-stone-200 to-amber-100" />
            )}
          </div>
        </div>

        {/* Description + CTA below banner */}
        <div className="py-8 lg:py-10">
          {exhibition.description && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 self-stretch bg-violet-600 rounded-full" />
                <h2 className="font-serif text-xl font-bold text-stone-900">
                  {lang === 'en' ? 'Exhibition Statement' : '展覽論述'}
                </h2>
              </div>
              <p className="text-stone-600 text-sm lg:text-base leading-loose whitespace-pre-wrap">
                {exhibition.description}
              </p>
            </div>
          )}
          <button
            onClick={() => router.push(`/exhibition/${exhibition.code}/works?lang=${lang}`)}
            className="inline-flex items-center gap-2 bg-violet-600 text-white px-6 py-3 text-sm font-medium tracking-wider hover:bg-violet-700 transition-colors"
          >
            {lang === 'en' ? 'View Exhibition Works' : '觀看展覽作品'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Divider line */}
      <div className="w-full border-t border-gray-200" />

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
