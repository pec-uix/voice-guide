'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';

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
  { code: 'ja' as LanguageCode, label: '日本語' },
];

export default function ExhibitionClient({ exhibition, artworks, translations, initialLang }: Props) {
  const [lang, setLang] = useState<LanguageCode>(initialLang);
  const scanRecorded = useRef(false);

  // Record exhibition scan once
  useEffect(() => {
    if (scanRecorded.current) return;
    scanRecorded.current = true;
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibition_id: exhibition.id, event_type: 'scan', language_code: lang }),
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getTitle = (artworkId: string) =>
    translations.find((tr) => tr.artwork_id === artworkId && tr.language_code === lang)?.title ??
    translations.find((tr) => tr.artwork_id === artworkId && tr.language_code === 'zh-TW')?.title ??
    artworkId;

  const handleReviewClick = () => {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exhibition_id: exhibition.id, event_type: 'click_review', language_code: lang }),
    }).catch(() => {});
  };

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

        {/* Exhibition name */}
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">{exhibition.name}</h1>
        {exhibition.description && (
          <p className="text-zinc-500 text-sm mb-8 leading-relaxed">{exhibition.description}</p>
        )}

        {/* Works heading */}
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
          {t('works', lang)}
        </h2>

        {/* Artwork grid */}
        {artworks.length === 0 ? (
          <p className="text-zinc-400 text-sm py-8 text-center">尚無作品</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-10">
            {artworks.map((aw) => (
              <Link
                key={aw.id}
                href={`/artwork/${aw.code}?lang=${lang}`}
                className="group block rounded-xl overflow-hidden border border-zinc-100 hover:border-zinc-300 transition-colors"
              >
                {aw.cover_image_url ? (
                  <img
                    src={aw.cover_image_url}
                    alt={getTitle(aw.id)}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-zinc-100 flex items-center justify-center">
                    <span className="text-zinc-300 text-3xl">♪</span>
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium text-zinc-900 leading-snug line-clamp-2">
                    {getTitle(aw.id)}
                  </p>
                  {aw.artist && (
                    <p className="text-xs text-zinc-400 mt-1">{aw.artist}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Review button — exhibition level, at bottom */}
        {exhibition.review_url && (
          <a
            href={exhibition.review_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleReviewClick}
            className="block w-full text-center border-2 border-zinc-900 text-zinc-900 py-4 rounded-2xl font-medium text-base hover:bg-zinc-50 transition-colors active:opacity-80"
          >
            {t('review', lang)}
          </a>
        )}
      </div>
    </div>
  );
}
