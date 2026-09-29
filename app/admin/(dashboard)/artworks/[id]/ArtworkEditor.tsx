'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCodeDisplay from '@/components/QRCodeDisplay';

interface Artwork { id: string; code: string; exhibition_id: string | null; artist: string | null; year: string | null; cover_image_url: string | null; }
interface Translation { id: string; language_code: string; title: string; description: string | null; audio_url: string | null; purchase_url: string | null; is_reviewed: boolean; }
interface SegmentText { language_code: string; text: string; is_reviewed: boolean; }
interface Segment { id: string; segment_index: number; start_time: number; end_time: number; texts: SegmentText[]; }
interface Exhibition { id: string; name: string; }

interface Props {
  artwork: Artwork;
  translations: Translation[];
  segments: Segment[];
  exhibitions: Exhibition[];
}

const LANG_LABEL: Record<string, string> = { 'zh-TW': '中文', en: 'English', ja: '日本語' };

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

function segmentsToText(segs: Segment[]) {
  return segs.map(s => `${s.start_time},${s.end_time},${s.texts.find(t => t.language_code === 'zh-TW')?.text ?? ''}`).join('\n');
}

function parseSegmentText(raw: string): { segment_index: number; start_time: number; end_time: number; text: string }[] | null {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 3) return null;
    const start = parseFloat(parts[0]);
    const end = parseFloat(parts[1]);
    const text = parts.slice(2).join(',').trim();
    if (isNaN(start) || isNaN(end) || !text) return null;
    result.push({ segment_index: i, start_time: start, end_time: end, text });
  }
  return result;
}

export default function ArtworkEditor({ artwork, translations, segments, exhibitions }: Props) {
  const router = useRouter();
  const [showQR, setShowQR] = useState(false);

  // Artwork metadata
  const [meta, setMeta] = useState({
    exhibition_id: artwork.exhibition_id ?? '',
    code: artwork.code,
    artist: artwork.artist ?? '',
    year: artwork.year ?? '',
    cover_image_url: artwork.cover_image_url ?? '',
  });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState('');

  // Translation editor state (per language)
  const [tForms, setTForms] = useState<Record<string, { title: string; description: string; purchase_url: string }>>(
    Object.fromEntries(
      translations.map(t => [t.language_code, { title: t.title, description: t.description ?? '', purchase_url: t.purchase_url ?? '' }])
    )
  );
  const [tSaving, setTSaving] = useState<Record<string, boolean>>({});
  const [tErrors, setTErrors] = useState<Record<string, string>>({});
  const [tReviewed, setTReviewed] = useState<Record<string, boolean>>(
    Object.fromEntries(translations.map(t => [t.language_code, t.is_reviewed]))
  );

  // Segments
  const [segText, setSegText] = useState(segmentsToText(segments));
  const [segSaving, setSegSaving] = useState(false);
  const [segError, setSegError] = useState('');

  const handleMetaSave = async () => {
    setMetaSaving(true); setMetaError('');
    try {
      const res = await fetch(`/api/artworks/${artwork.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meta,
          exhibition_id: meta.exhibition_id || null,
          artist: meta.artist || null,
          year: meta.year || null,
          cover_image_url: meta.cover_image_url || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMetaError(json.error ?? '儲存失敗'); return; }
      router.refresh();
    } catch { setMetaError('網路錯誤'); }
    finally { setMetaSaving(false); }
  };

  const handleTranslationSave = async (lang: string, markReviewed?: boolean) => {
    setTSaving(s => ({ ...s, [lang]: true }));
    setTErrors(e => ({ ...e, [lang]: '' }));
    try {
      const body: Record<string, unknown> = { ...tForms[lang] };
      if (markReviewed !== undefined) body.is_reviewed = markReviewed;
      const res = await fetch(`/api/artworks/${artwork.id}/translations/${lang}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setTErrors(e => ({ ...e, [lang]: json.error ?? '儲存失敗' })); return; }
      if (markReviewed !== undefined) setTReviewed(r => ({ ...r, [lang]: markReviewed }));
      router.refresh();
    } catch { setTErrors(e => ({ ...e, [lang]: '網路錯誤' })); }
    finally { setTSaving(s => ({ ...s, [lang]: false })); }
  };

  const handleSegmentSave = async () => {
    const parsed = parseSegmentText(segText);
    if (!parsed) { setSegError('格式錯誤，每行應為：開始秒數,結束秒數,文字'); return; }
    setSegSaving(true); setSegError('');
    try {
      const res = await fetch(`/api/artworks/${artwork.id}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: parsed }),
      });
      const json = await res.json();
      if (!res.ok) { setSegError(json.error ?? '儲存失敗'); return; }
      router.refresh();
    } catch { setSegError('網路錯誤'); }
    finally { setSegSaving(false); }
  };

  const allLangs = ['zh-TW', 'en', 'ja'];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/admin/artworks" className="hover:text-zinc-800">作品管理</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{tForms['zh-TW']?.title || artwork.code}</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">編輯作品</h1>
        <button onClick={() => setShowQR(!showQR)} className="btn-ghost text-sm">
          {showQR ? '關閉 QR Code' : '📱 QR Code'}
        </button>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">作品 QR Code</h2>
          <QRCodeDisplay url={`${BASE_URL}/artwork/${artwork.code}`} label={`artwork-${artwork.code}`} />
        </div>
      )}

      {/* Metadata */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">基本資料</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">作品代碼</label>
            <input className="form-input" value={meta.code}
              onChange={e => setMeta(m => ({ ...m, code: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">所屬展覽</label>
            <select className="form-input" value={meta.exhibition_id}
              onChange={e => setMeta(m => ({ ...m, exhibition_id: e.target.value }))}>
              <option value="">不指定</option>
              {exhibitions.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">藝術家</label>
            <input className="form-input" value={meta.artist}
              onChange={e => setMeta(m => ({ ...m, artist: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">年代</label>
            <input className="form-input" placeholder="例：2024" value={meta.year}
              onChange={e => setMeta(m => ({ ...m, year: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">封面圖片網址</label>
            <input className="form-input" placeholder="https://..." value={meta.cover_image_url}
              onChange={e => setMeta(m => ({ ...m, cover_image_url: e.target.value }))} />
          </div>
        </div>
        {metaError && <p className="text-red-500 text-sm mt-3">{metaError}</p>}
        <div className="mt-4">
          <button onClick={handleMetaSave} disabled={metaSaving} className="btn-primary">
            {metaSaving ? '儲存中…' : '儲存基本資料'}
          </button>
        </div>
      </section>

      {/* Audio */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">音檔</h2>
        <p className="text-sm text-zinc-500 mb-4">僅提供中文原音，不做其他語言配音。</p>
        {translations.find(t => t.language_code === 'zh-TW')?.audio_url ? (
          <div className="flex items-center gap-3">
            <audio controls src={translations.find(t => t.language_code === 'zh-TW')!.audio_url!} className="max-w-xs" />
            <span className="text-xs text-zinc-400">已上傳</span>
          </div>
        ) : (
          <p className="text-sm text-zinc-400 bg-zinc-50 rounded-xl p-4">
            音檔上傳功能將在部署到 Cloudflare 後啟用（需要 R2 儲存設定）。
          </p>
        )}
      </section>

      {/* Translations */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">多語言內容</h2>
        <div className="space-y-6">
          {allLangs.map(lang => {
            const t = translations.find(tr => tr.language_code === lang);
            const form = tForms[lang] ?? { title: '', description: '', purchase_url: '' };
            const isReviewed = tReviewed[lang] ?? false;
            const isSaving = tSaving[lang] ?? false;
            const err = tErrors[lang] ?? '';

            return (
              <div key={lang} className="border border-zinc-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-zinc-700">{LANG_LABEL[lang]}</span>
                  {lang !== 'zh-TW' && (
                    isReviewed ? (
                      <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">已校對</span>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">待校對</span>
                    )
                  )}
                </div>
                {!t && lang !== 'zh-TW' && (
                  <p className="text-xs text-zinc-400 mb-2">翻譯草稿尚未生成（儲存中文內容後會自動產生）</p>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="form-label">標題</label>
                    <input className="form-input" value={form.title}
                      onChange={e => setTForms(f => ({ ...f, [lang]: { ...f[lang], title: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="form-label">介紹文字</label>
                    <textarea className="form-input" rows={3} value={form.description}
                      onChange={e => setTForms(f => ({ ...f, [lang]: { ...f[lang], description: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="form-label">購買連結</label>
                    <input className="form-input" placeholder="https://..." value={form.purchase_url}
                      onChange={e => setTForms(f => ({ ...f, [lang]: { ...f[lang], purchase_url: e.target.value } }))} />
                  </div>
                </div>
                {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleTranslationSave(lang)} disabled={isSaving} className="btn-primary text-xs py-1.5 px-3">
                    {isSaving ? '儲存中…' : '儲存'}
                  </button>
                  {lang !== 'zh-TW' && !isReviewed && t && (
                    <button onClick={() => handleTranslationSave(lang, true)} disabled={isSaving}
                      className="text-xs text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-1.5 transition-colors">
                      標記為已校對
                    </button>
                  )}
                  {lang !== 'zh-TW' && isReviewed && (
                    <button onClick={() => handleTranslationSave(lang, false)} disabled={isSaving}
                      className="text-xs text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors">
                      取消校對
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Segments */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-1">逐字稿（中文，含時間戳記）</h2>
        <p className="text-sm text-zinc-500 mb-1">每行格式：<code className="bg-zinc-100 px-1 rounded">開始秒數,結束秒數,文字</code></p>
        <p className="text-xs text-zinc-400 mb-4">儲存後會自動產生英文和日文翻譯草稿。</p>
        <textarea
          className="form-input font-mono text-sm"
          rows={8}
          value={segText}
          onChange={e => setSegText(e.target.value)}
          placeholder={'0,9,這件作品名為…\n9,20,藝術家以…\n20,30,流動的水面…'}
        />
        {segError && <p className="text-red-500 text-sm mt-2">{segError}</p>}
        <div className="mt-3">
          <button onClick={handleSegmentSave} disabled={segSaving} className="btn-primary">
            {segSaving ? '儲存並翻譯中…' : '儲存逐字稿並自動翻譯'}
          </button>
        </div>
        {segments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 mb-2">目前逐字稿翻譯狀態</p>
            <div className="space-y-1">
              {segments.map(s => {
                const pending = s.texts.filter(t => t.language_code !== 'zh-TW' && !t.is_reviewed);
                return (
                  <div key={s.id} className="text-xs text-zinc-500 flex gap-2">
                    <span className="w-14 text-zinc-400">段落 {s.segment_index + 1}</span>
                    <span>{s.texts.find(t => t.language_code === 'zh-TW')?.text.slice(0, 30)}…</span>
                    {pending.length > 0 && (
                      <span className="text-amber-600">（{pending.map(t => t.language_code).join('、')} 待校對）</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
