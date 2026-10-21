'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { LanguageCode } from '@/lib/types';

const LANGS = [
  { code: 'zh-TW' as LanguageCode, label: '中文' },
  { code: 'en' as LanguageCode, label: 'EN' },
];

interface Props {
  lang: LanguageCode;
  onLangChange: (l: LanguageCode) => void;
  logoHref?: string;
}

export default function GalleryHeader({ lang, onLangChange, logoHref = '/' }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 relative z-10">
      <Link href={logoHref}>
        <Image
          src="/logo.jpg"
          alt="玲廊滿藝 Celestial Serendipity"
          width={120}
          height={72}
          className="object-contain"
          priority
        />
      </Link>
      <div className="flex gap-3">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => onLangChange(l.code)}
            className={`text-xs tracking-wider transition-colors ${
              lang === l.code
                ? 'text-stone-900 border-b border-stone-700'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </header>
  );
}
