'use client';

import { useState } from 'react';
import type { LanguageCode } from '@/lib/types';
import { t } from '@/lib/i18n';

interface Props {
  exhibitionId: string;
  lang: LanguageCode;
  onClose: () => void;
}

const LS_KEY = (id: string) => `vg_fb_submitted_${id}`;

export function markFeedbackSubmitted(exhibitionId: string) {
  try { localStorage.setItem(LS_KEY(exhibitionId), '1'); } catch {}
}

export function isFeedbackSubmitted(exhibitionId: string): boolean {
  try { return !!localStorage.getItem(LS_KEY(exhibitionId)); } catch { return false; }
}

export default function FeedbackModal({ exhibitionId, lang, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await fetch(`/api/exhibitions/${exhibitionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || null, language_code: lang }),
      });
    } catch {}
    markFeedbackSubmitted(exhibitionId);
    setDone(true);
    setTimeout(onClose, 1800);
  };

  const handleSkip = () => {
    markFeedbackSubmitted(exhibitionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleSkip} />

      {/* sheet */}
      <div className="relative bg-[#faf7f2] rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
        {done ? (
          <div className="py-8 text-center">
            <p className="text-2xl mb-2">🙏</p>
            <p className="font-serif text-lg font-semibold text-stone-900">{t('feedbackThanks', lang)}</p>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-xl font-semibold text-stone-900 mb-1">
              {t('feedbackTitle', lang)}
            </h2>
            <p className="text-sm text-stone-500 mb-6">{t('feedbackPrompt', lang)}</p>

            {/* Star rating */}
            <div className="flex gap-3 mb-6 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-4xl transition-transform active:scale-90"
                  aria-label={`${star} 星`}
                >
                  <span className={(hovered || rating) >= star ? 'text-amber-400' : 'text-stone-200'}>
                    ★
                  </span>
                </button>
              ))}
            </div>

            {/* Comment */}
            <textarea
              className="w-full bg-stone-100 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400 resize-none mb-5 focus:outline-none focus:ring-2 focus:ring-stone-300"
              rows={3}
              placeholder={t('feedbackComment', lang)}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />

            <button
              onClick={handleSubmit}
              disabled={!rating || submitting}
              className="w-full bg-stone-900 text-white text-sm font-medium py-3.5 rounded-xl disabled:opacity-40 transition-opacity mb-3"
            >
              {submitting ? '…' : t('feedbackSubmit', lang)}
            </button>
            <button
              onClick={handleSkip}
              className="w-full text-stone-400 text-sm py-2"
            >
              {t('feedbackSkip', lang)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
