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

const LANG_LABEL: Record<string, string> = { 'zh-TW': '中文', en: 'English' };

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

function LangTabs({ value, onChange, pendingLangs = [] }: {
  value: 'zh-TW' | 'en';
  onChange: (l: 'zh-TW' | 'en') => void;
  pendingLangs?: string[];
}) {
  return (
    <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-1 w-fit">
      {(['zh-TW', 'en'] as const).map(l => (
        <button key={l} onClick={() => onChange(l)}
          className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === l ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          {LANG_LABEL[l]}
          {pendingLangs.includes(l) && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full border-2 border-stone-100" />
          )}
        </button>
      ))}
    </div>
  );
}

export default function ArtworkEditor({ artwork, translations, segments, exhibitions }: Props) {
  const router = useRouter();
  const [showQR, setShowQR] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Single dirty flag — set true on any content change, reset after save
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveWarning, setSaveWarning] = useState('');
  const [segFormatError, setSegFormatError] = useState('');

  const markDirty = () => setIsDirty(true);

  // Import from URL
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importDone, setImportDone] = useState(false);

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true); setImportError(''); setImportDone(false);
    try {
      const res = await fetch('/api/artworks/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setImportError(json.error ?? '匯入失敗'); return; }
      const d = json.data;
      if (d.artist) setMeta(m => ({ ...m, artist: d.artist }));
      if (d.year) setMeta(m => ({ ...m, year: String(d.year) }));
      if (d.cover_image_url) setMeta(m => ({ ...m, cover_image_url: d.cover_image_url }));
      if (d.purchase_url) setTForms(f => ({ ...f, 'zh-TW': { ...f['zh-TW'], purchase_url: d.purchase_url } }));
      if (d.title) setTForms(f => ({ ...f, 'zh-TW': { ...f['zh-TW'], title: d.title } }));
      if (d.description) setTForms(f => ({ ...f, 'zh-TW': { ...f['zh-TW'], description: d.description } }));
      if (d.title_en) setTForms(f => ({ ...f, 'en': { ...f['en'], title: d.title_en } }));
      if (d.description_en) setTForms(f => ({ ...f, 'en': { ...f['en'], description: d.description_en } }));
      setImportDone(true);
      markDirty();
    } catch { setImportError('網路錯誤'); }
    finally { setImporting(false); }
  };

  // Artwork metadata
  const [meta, setMeta] = useState({
    exhibition_id: artwork.exhibition_id ?? '',
    code: artwork.code,
    artist: artwork.artist ?? '',
    year: artwork.year ?? '',
    cover_image_url: artwork.cover_image_url ?? '',
  });

  // Translations (always initialise both languages to avoid partial-state issues)
  const [translationLang, setTranslationLang] = useState<'zh-TW' | 'en'>('zh-TW');
  const [tForms, setTForms] = useState<Record<string, { title: string; description: string; purchase_url: string }>>({
    'zh-TW': { title: '', description: '', purchase_url: '' },
    'en':    { title: '', description: '', purchase_url: '' },
    ...Object.fromEntries(
      translations.map(t => [t.language_code, {
        title: t.title,
        description: t.description ?? '',
        purchase_url: t.purchase_url ?? '',
      }])
    ),
  });
  const [tSaving, setTSaving] = useState<Record<string, boolean>>({});
  const [tErrors, setTErrors] = useState<Record<string, string>>({});
  const [tReviewed, setTReviewed] = useState<Record<string, boolean>>(
    Object.fromEntries(translations.map(t => [t.language_code, t.is_reviewed]))
  );

  // Audio — zh-TW only (frontend plays Chinese audio only per spec)
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(
    translations.find(t => t.language_code === 'zh-TW')?.audio_url ?? null
  );

  const handleAudioDelete = async () => {
    if (!confirm('確定要刪除音檔嗎？')) return;
    setAudioError('');
    try {
      const res = await fetch(`/api/artworks/${artwork.id}/translations/zh-TW`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: null }),
      });
      const json = await res.json();
      if (!res.ok) { setAudioError(json.error ?? '刪除失敗'); return; }
      setAudioUrl(null);
    } catch { setAudioError('網路錯誤'); }
  };

  const handleAudioUpload = async () => {
    if (!audioFile) return;
    setAudioUploading(true); setAudioError('');
    try {
      const fd = new FormData();
      fd.append('audio', audioFile);
      fd.append('lang', 'zh-TW');
      const res = await fetch(`/api/artworks/${artwork.id}/audio`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setAudioError(json.error ?? '上傳失敗'); return; }
      setAudioUrl(json.data.audio_url);
      setAudioFile(null);
    } catch { setAudioError('網路錯誤'); }
    finally { setAudioUploading(false); }
  };

  // Segments
  const [segText, setSegText] = useState(segmentsToText(segments));
  const [transcribing, setTranscribing] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [ttsVoiceZh, setTtsVoiceZh] = useState('zh-TW-HsiaoChenNeural');

  const extractPlainText = (raw: string) =>
    raw.trim().split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(',');
      if (parts.length >= 3 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        return parts.slice(2).join(',').trim();
      }
      return line.trim();
    }).join('\n');

  const handleGenerateAudio = async () => {
    const text = extractPlainText(segText);
    if (!text) { setAudioError('請先填入逐字稿'); return; }
    setGeneratingAudio(true); setAudioError('');
    try {
      const res = await fetch(`/api/artworks/${artwork.id}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: ttsVoiceZh, lang: 'zh-TW' }),
      });
      const json = await res.json();
      if (!res.ok) { setAudioError(json.error ?? '音檔產生失敗'); return; }
      setAudioUrl(json.data.audio_url);
    } catch { setAudioError('網路錯誤'); }
    finally { setGeneratingAudio(false); }
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const res = await fetch(`/api/artworks/${artwork.id}/transcribe`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setAudioError(json.error ?? '辨識失敗'); return; }
      const lines = json.data.map((s: { start_time: number; end_time: number; text: string }) =>
        `${s.start_time},${s.end_time},${s.text}`
      ).join('\n');
      setSegText(lines);
      markDirty();
    } catch { setAudioError('網路錯誤'); }
    finally { setTranscribing(false); }
  };

  // Reviewed status — immediate save, separate from main dirty flow
  const handleReviewedToggle = async (lang: string, markReviewed: boolean) => {
    setTSaving(s => ({ ...s, [lang]: true }));
    setTErrors(e => ({ ...e, [lang]: '' }));
    try {
      const res = await fetch(`/api/artworks/${artwork.id}/translations/${lang}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tForms[lang], is_reviewed: markReviewed }),
      });
      const json = await res.json();
      if (!res.ok) { setTErrors(e => ({ ...e, [lang]: json.error ?? '更新失敗' })); return; }
      setTReviewed(r => ({ ...r, [lang]: markReviewed }));
    } catch { setTErrors(e => ({ ...e, [lang]: '網路錯誤' })); }
    finally { setTSaving(s => ({ ...s, [lang]: false })); }
  };

  // ── Single save for all content ──────────────────────────────────────────
  const handleSaveAll = async () => {
    setSaveError(''); setSegFormatError('');

    // Validate segments before calling any API
    if (segText.trim()) {
      const parsed = parseSegmentText(segText);
      if (!parsed) {
        setSegFormatError('格式錯誤，每行應為：開始秒數,結束秒數,文字');
        return;
      }
    }

    setSaving(true);
    setSaveWarning('');
    const errors: string[] = [];
    let hasTranslationWarning = false;

    try {
      // Save metadata
      const metaRes = await fetch(`/api/artworks/${artwork.id}`, {
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
      if (!metaRes.ok) {
        const j = await metaRes.json();
        errors.push(j.error ?? '基本資料儲存失敗');
      } else {
        const j = await metaRes.json();
        if (j.translation_warning) hasTranslationWarning = true;
      }

      // Save translations (skip languages with no content and no existing DB row)
      for (const lang of ['zh-TW', 'en'] as const) {
        const form = tForms[lang];
        const existsInDb = translations.some(t => t.language_code === lang);
        const hasContent = form.title.trim() || form.description.trim() || form.purchase_url.trim();
        if (!existsInDb && !hasContent) continue;

        const tRes = await fetch(`/api/artworks/${artwork.id}/translations/${lang}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!tRes.ok) {
          const j = await tRes.json();
          errors.push(j.error ?? `${LANG_LABEL[lang]}內容儲存失敗`);
        }
      }

      // Save segments (triggers auto-translate)
      if (segText.trim()) {
        const parsed = parseSegmentText(segText)!;
        const sRes = await fetch(`/api/artworks/${artwork.id}/segments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments: parsed }),
        });
        const sJson = await sRes.json();
        if (!sRes.ok) {
          errors.push(sJson.error ?? '逐字稿儲存失敗');
        } else if (sJson.translation_warning) {
          hasTranslationWarning = true;
        }
      }

      if (errors.length > 0) {
        setSaveError(errors.join('；'));
      } else {
        setIsDirty(false);
        if (hasTranslationWarning) setSaveWarning('自動翻譯失敗，請手動填寫英文內容（待校對標記已標出）');
        router.refresh();
      }
    } catch {
      setSaveError('網路錯誤，請重試');
    } finally {
      setSaving(false);
    }
  };

  const pendingTranslationLangs = (['en'] as const).filter(l => {
    const tr = translations.find(t => t.language_code === l);
    return tr && !tr.is_reviewed;
  });

  const pendingSegLangs = (['en'] as const).filter(l =>
    segments.some(s => s.texts.some(t => t.language_code === l && !t.is_reviewed))
  );

  return (
    <div className={isDirty ? 'pb-20' : ''}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-4">
        <Link href="/admin/artworks" className="hover:text-stone-800">作品管理</Link>
        <span>/</span>
        <span className="text-stone-900 font-medium">{tForms['zh-TW']?.title || artwork.code}</span>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-stone-900">編輯作品</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(v => !v); setImportDone(false); setImportError(''); }}
            className="btn-ghost text-sm"
          >
            {showImport ? '收起匯入' : '從網址匯入'}
          </button>
          <button onClick={() => setShowQR(!showQR)} className="btn-ghost text-sm">
            {showQR ? '關閉 QR Code' : '📱 QR Code'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-6 mb-4">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">作品 QR Code</h2>
          <QRCodeDisplay url={`${BASE_URL}/artwork/${artwork.code}`} label={`artwork-${artwork.code}`} />
        </div>
      )}

      {/* Import from URL */}
      {showImport && (
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-4">
          <p className="text-sm text-stone-600 mb-3">貼上作品頁網址，自動填入標題、藝術家、介紹、封面圖。</p>
          <div className="flex gap-2">
            <input
              className="form-input flex-1"
              placeholder="https://www.uniart.com.tw/products/..."
              value={importUrl}
              onChange={e => { setImportUrl(e.target.value); setImportDone(false); setImportError(''); }}
            />
            <button onClick={handleImportUrl} disabled={importing || !importUrl.trim()} className="btn-primary whitespace-nowrap">
              {importing ? '解析中…' : '匯入'}
            </button>
          </div>
          {importError && <p className="text-red-500 text-sm mt-2">{importError}</p>}
          {importDone && <p className="text-green-600 text-sm mt-2">✓ 已填入資料，請確認後儲存。</p>}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* ── Left column: content ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Metadata */}
          <section className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-stone-900 mb-4">基本資料</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">作品代碼</label>
                <input className="form-input" value={meta.code}
                  onChange={e => { setMeta(m => ({ ...m, code: e.target.value })); markDirty(); }} />
              </div>
              <div>
                <label className="form-label">所屬展覽</label>
                <select className="form-input" value={meta.exhibition_id}
                  onChange={e => { setMeta(m => ({ ...m, exhibition_id: e.target.value })); markDirty(); }}>
                  <option value="">不指定</option>
                  {exhibitions.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">藝術家</label>
                <input className="form-input" value={meta.artist}
                  onChange={e => { setMeta(m => ({ ...m, artist: e.target.value })); markDirty(); }} />
              </div>
              <div>
                <label className="form-label">年代</label>
                <input className="form-input" placeholder="例：2024" value={meta.year}
                  onChange={e => { setMeta(m => ({ ...m, year: e.target.value })); markDirty(); }} />
              </div>
              <div className="col-span-2">
                <label className="form-label">封面圖片網址</label>
                <input className="form-input" placeholder="https://..." value={meta.cover_image_url}
                  onChange={e => { setMeta(m => ({ ...m, cover_image_url: e.target.value })); markDirty(); }} />
              </div>
            </div>
          </section>

          {/* Translations */}
          <section className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-stone-900 mb-4">多語言內容</h2>

            <LangTabs value={translationLang} onChange={setTranslationLang} pendingLangs={pendingTranslationLangs} />

            {(() => {
              const lang = translationLang;
              const tr = translations.find(t => t.language_code === lang);
              const form = tForms[lang] ?? { title: '', description: '', purchase_url: '' };
              const isReviewed = tReviewed[lang] ?? false;
              const isSaving = tSaving[lang] ?? false;
              const err = tErrors[lang] ?? '';
              return (
                <div>
                  {lang !== 'zh-TW' && (
                    <div className="mb-3">
                      {isReviewed
                        ? <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">已校對</span>
                        : <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">待校對</span>
                      }
                    </div>
                  )}
                  {!tr && lang !== 'zh-TW' && (
                    <p className="text-xs text-stone-400 mb-3">翻譯草稿尚未生成（儲存中文內容後會自動產生）</p>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">標題</label>
                      <input className="form-input" value={form.title}
                        onChange={e => { setTForms(f => ({ ...f, [lang]: { ...f[lang], title: e.target.value } })); markDirty(); }} />
                    </div>
                    <div>
                      <label className="form-label">介紹文字</label>
                      <textarea className="form-input" rows={4} value={form.description}
                        onChange={e => { setTForms(f => ({ ...f, [lang]: { ...f[lang], description: e.target.value } })); markDirty(); }} />
                    </div>
                    <div>
                      <label className="form-label">購買連結</label>
                      <input className="form-input" placeholder="https://..." value={form.purchase_url}
                        onChange={e => { setTForms(f => ({ ...f, [lang]: { ...f[lang], purchase_url: e.target.value } })); markDirty(); }} />
                    </div>
                  </div>
                  {err && <p className="text-red-500 text-xs mt-2">{err}</p>}
                  {lang !== 'zh-TW' && tr && (
                    <div className="flex gap-2 mt-3">
                      {!isReviewed
                        ? <button onClick={() => handleReviewedToggle(lang, true)} disabled={isSaving}
                            className="text-xs text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-1.5 transition-colors">
                            {isSaving ? '更新中…' : '標記為已校對'}
                          </button>
                        : <button onClick={() => handleReviewedToggle(lang, false)} disabled={isSaving}
                            className="text-xs text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 transition-colors">
                            {isSaving ? '更新中…' : '取消校對'}
                          </button>
                      }
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

        </div>

        {/* ── Right column: media ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Audio — zh-TW only */}
          <section className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-stone-900 mb-4">音檔（中文）</h2>

            {audioUrl ? (
              <div className="mb-4">
                <audio controls src={audioUrl} className="w-full" />
                <button onClick={handleAudioDelete} className="mt-1.5 text-xs text-red-500 hover:text-red-700">
                  刪除音檔
                </button>
              </div>
            ) : (
              <p className="text-xs text-stone-400 mb-4">尚未上傳音檔</p>
            )}

            <div className="flex flex-wrap gap-2 items-center mb-4">
              <label className="cursor-pointer">
                <span className="btn-ghost text-sm">{audioUrl ? '重新上傳' : '選擇音檔'}</span>
                <input type="file" accept="audio/*" className="hidden"
                  onChange={e => { setAudioFile(e.target.files?.[0] ?? null); setAudioError(''); }} />
              </label>
              {audioFile && (
                <>
                  <span className="text-xs text-stone-500 truncate max-w-[120px]">{audioFile.name}</span>
                  <button onClick={handleAudioUpload} disabled={audioUploading} className="btn-primary text-sm">
                    {audioUploading ? '上傳中…' : '上傳'}
                  </button>
                </>
              )}
            </div>

            <div className="border-t border-stone-100 pt-4">
              <p className="text-xs text-stone-400 mb-2">或從逐字稿產生音檔</p>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={ttsVoiceZh} onChange={e => setTtsVoiceZh(e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700 bg-[#faf7f2] flex-1 min-w-0">
                  <option value="zh-TW-HsiaoChenNeural">曉臻（女）</option>
                  <option value="zh-TW-HsiaoYuNeural">曉雨（女）</option>
                  <option value="zh-TW-YunJheNeural">雲哲（男）</option>
                </select>
                <button onClick={handleGenerateAudio} disabled={generatingAudio} className="btn-ghost text-sm whitespace-nowrap">
                  {generatingAudio ? '產生中…' : '🎙 產生音檔'}
                </button>
              </div>
              {audioUrl && (
                <button onClick={handleTranscribe} disabled={transcribing} className="mt-2 btn-ghost text-sm w-full">
                  {transcribing ? '辨識中…' : '✨ 自動辨識時間戳記'}
                </button>
              )}
            </div>

            {audioError && <p className="text-red-500 text-sm mt-3">{audioError}</p>}
          </section>

          {/* Segments */}
          <section className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-stone-900">逐字稿</h2>
              {pendingSegLangs.length > 0 && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">英文待校對</span>
              )}
            </div>
            <p className="text-xs text-stone-400 mb-3">
              每行：<code className="bg-stone-100 px-1 rounded">開始秒,結束秒,中文文字</code>　儲存後自動翻譯英文。
            </p>
            <textarea
              className="form-input font-mono text-sm"
              rows={7}
              value={segText}
              onChange={e => { setSegText(e.target.value); markDirty(); setSegFormatError(''); }}
              placeholder={'0,9,這件作品名為…\n9,20,藝術家以…\n20,30,流動的水面…'}
            />
            {segFormatError && <p className="text-red-500 text-sm mt-2">{segFormatError}</p>}
          </section>

        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${isDirty ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-[#faf7f2]/95 backdrop-blur border-t border-stone-200 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            <span className="text-sm text-stone-500">
              {saving ? '儲存中…' : saveError ? '' : '有未儲存的變更'}
            </span>
            {saveError && <p className="text-red-500 text-sm flex-1">{saveError}</p>}
            {!saveError && saveWarning && <p className="text-amber-600 text-sm flex-1">{saveWarning}</p>}
            <button
              onClick={handleSaveAll}
              disabled={saving || !isDirty}
              className="btn-primary whitespace-nowrap"
            >
              {saving ? '儲存中…' : '儲存所有變更'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
