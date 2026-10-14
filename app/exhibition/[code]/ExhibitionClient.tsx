'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';
import FeedbackModal, { isFeedbackSubmitted } from '@/components/FeedbackModal';

interface Exhibition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  review_url: string | null;
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

  // Show feedback modal: triggered by last-artwork audio end OR page-leave detection
  useEffect(() => {
    const exId = exhibition.id;

    // If already submitted, do nothing
    if (isFeedbackSubmitted(exId)) return;

    // If trigger flag was set (e.g. from artwork page), show after short delay
    const triggerKey = TRIGGER_KEY(exId);
    const hasTrigger = (() => { try { return !!localStorage.getItem(triggerKey); } catch { return false; } })();
    if (hasTrigger) {
      try { localStorage.removeItem(triggerKey); } catch {}
      const t = setTimeout(() => setShowFeedback(true), 600);
      return () => clearTimeout(t);
    }

    // Detect page-leave via visibilitychange (most reliable on mobile)
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      const elapsed = Date.now() - pageEntryTime.current;
      if (elapsed < 10_000) return; // ignore accidental quick exits
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
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="max-w-xl mx-auto px-6 pt-10 pb-24">

        {/* Language switcher */}
        <div className="flex justify-end gap-4 mb-10">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`text-xs tracking-wider transition-colors pb-0.5 ${
                lang === l.code
                  ? 'text-stone-900 border-b border-stone-800'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Exhibition header */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold text-stone-900 leading-tight mb-3">
            {exhibition.name}
          </h1>
          {exhibition.description && (
            <p className="text-stone-500 text-sm leading-relaxed">{exhibition.description}</p>
          )}
        </div>

        <div className="border-t border-stone-200 mb-8" />

        {/* Works label */}
        <p className="text-xs text-stone-400 tracking-widest uppercase mb-6">
          {t('works', lang)}
        </p>

        {/* Artwork grid */}
        {artworks.length === 0 ? (
          <p className="text-stone-400 text-sm py-16 text-center">尚無作品</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 mb-12">
            {artworks.map((aw) => (
              <Link
                key={aw.id}
                href={`/artwork/${aw.code}?lang=${lang}`}
                className="group block"
              >
                {/* Image */}
                <div className="w-full overflow-hidden mb-3" style={{ aspectRatio: '3/4' }}>
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

                {/* Text */}
                <p className="text-xs text-stone-400 mb-1 tracking-wider">
                  {aw.artist ?? ''}
                </p>
                <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2 group-hover:underline underline-offset-2 transition-all">
                  {getTitle(aw.id)}
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Feedback button — manual trigger */}
        <button
          onClick={() => setShowFeedback(true)}
          className="block w-full text-center border border-stone-300 text-stone-500 py-4 text-sm tracking-wider hover:border-stone-500 hover:text-stone-700 transition-colors rounded-lg"
        >
          {t('feedbackTitle', lang)}
        </button>
      </div>

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
