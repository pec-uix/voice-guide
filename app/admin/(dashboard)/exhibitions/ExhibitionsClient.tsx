'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import QRCodeDisplay from '@/components/QRCodeDisplay';

interface ArtworkRow {
  id: string;
  code: string;
  cover_image_url: string | null;
  artist: string | null;
  title: string | null;
  audio_url: string | null;
}

interface Exhibition {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  review_url: string | null;
  cover_image_url: string | null;
  mobile_cover_image_url: string | null;
  artwork_count: number;
  created_at: string;
}

interface ImportedArtwork {
  productId?: number;
  title: string;
  title_en?: string | null;
  artist?: string;
  year?: string;
  description?: string;
  imageUrl?: string;
  purchaseUrl?: string;
}

interface Props {
  exhibitions: Exhibition[];
}

const BASE_URL = typeof window !== 'undefined'
  ? window.location.origin
  : process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

function emptyForm() {
  return { code: '', name: '', name_en: '', description: '', description_en: '', cover_image_url: '', mobile_cover_image_url: '' };
}

export default function ExhibitionsClient({ exhibitions: initial }: Props) {
  const router = useRouter();
  const [exhibitions, setExhibitions] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formLang, setFormLang] = useState<'zh' | 'en'>('zh');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importedArtworks, setImportedArtworks] = useState<ImportedArtwork[] | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState('');
  const [codeAutoFilled, setCodeAutoFilled] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');

  const [editArtworks, setEditArtworks] = useState<ArtworkRow[]>([]);
  const [editArtworksLoading, setEditArtworksLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [qrModal, setQrModal] = useState<{ id: string; name: string; code: string } | null>(null);

  useEffect(() => {
    if (!editId) { setEditArtworks([]); return; }
    setEditArtworksLoading(true);
    fetch(`/api/artworks?exhibition_id=${editId}`)
      .then(r => r.json())
      .then(j => setEditArtworks(j.data ?? []))
      .catch(() => setEditArtworks([]))
      .finally(() => setEditArtworksLoading(false));
  }, [editId]);

  const handleImageUpload = async (id: string) => {
    if (!imageFile) return;
    setImageUploading(true); setImageError('');
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch(`/api/exhibitions/${id}/image`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setImageError(json.error ?? '上傳失敗'); return; }
      setExhibitions(prev => prev.map(e =>
        e.id === id ? { ...e, cover_image_url: json.data.cover_image_url } : e
      ));
      setForm(f => ({ ...f, cover_image_url: json.data.cover_image_url }));
      setImageFile(null);
    } catch { setImageError('網路錯誤'); }
    finally { setImageUploading(false); }
  };

  const resetImport = () => {
    setImportUrl('');
    setImportError('');
    setImportedArtworks(null);
  };

  const openCreate = () => {
    setEditId(null); setForm(emptyForm()); setError(''); setShowForm(true);
    resetImport(); setBatchSuccess(''); setImageFile(null); setImageError(''); setCodeAutoFilled(false);
  };
  const openEdit = (ex: Exhibition) => {
    setEditId(ex.id);
    setForm({
      code: ex.code,
      name: ex.name,
      name_en: ex.name_en ?? '',
      description: ex.description ?? '',
      description_en: ex.description_en ?? '',
      cover_image_url: ex.cover_image_url ?? '',
      mobile_cover_image_url: ex.mobile_cover_image_url ?? '',
    });
    setError('');
    setFormLang('zh');
    setShowForm(true);
    resetImport(); setBatchSuccess(''); setImageFile(null); setImageError(''); setCodeAutoFilled(false);
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true); setImportError(''); setImportedArtworks(null); setBatchSuccess('');
    try {
      const res = await fetch('/api/exhibitions/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setImportError(json.error ?? '匯入失敗'); return; }
      const d = json.data;
      setForm(f => ({
        ...f,
        ...(d.name ? { name: d.name } : {}),
        ...(d.name_en ? { name_en: d.name_en } : {}),
        ...(d.description ? { description: d.description } : {}),
        ...(d.description_en ? { description_en: d.description_en } : {}),
        ...(d.cover_image_url ? { cover_image_url: d.cover_image_url } : {}),
        ...(d.mobile_cover_image_url ? { mobile_cover_image_url: d.mobile_cover_image_url } : {}),
      }));
      if (d.artworks?.length) setImportedArtworks(d.artworks);
    } catch { setImportError('網路錯誤'); }
    finally { setImporting(false); }
  };

  const handleBatchImport = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('請先填入展覽代碼和名稱'); return; }
    setBatchSaving(true); setError('');
    try {
      const res = await fetch('/api/exhibitions/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          name_en: form.name_en || null,
          description: form.description || null,
          description_en: form.description_en || null,
          cover_image_url: form.cover_image_url || null,
          mobile_cover_image_url: form.mobile_cover_image_url || null,
          artworks: importedArtworks,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '批次建立失敗'); return; }
      const msg = `已建立展覽「${form.name}」及 ${json.data.artworksCreated} 件作品`;
      setShowForm(false);
      resetImport();
      setExhibitions(prev => [{ ...json.data.exhibition, artwork_count: json.data.artworksCreated }, ...prev]);
      setBatchSuccess(msg);
      setTimeout(() => setBatchSuccess(''), 3000);
    } catch { setError('網路錯誤'); }
    finally { setBatchSaving(false); }
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('代碼和名稱為必填'); return; }
    setSaving(true); setError('');
    try {
      const url = editId ? `/api/exhibitions/${editId}` : '/api/exhibitions';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '儲存失敗'); return; }
      if (editId) {
        setExhibitions(prev => prev.map(e => e.id === editId ? { ...e, ...json.data } : e));
      } else {
        setExhibitions(prev => [{ ...json.data, artwork_count: 0 }, ...prev]);
      }
      setShowForm(false);
      router.refresh();
    } catch {
      setError('網路錯誤');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const [batchQrLoading, setBatchQrLoading] = useState(false);

  const handleBatchQR = async (exOverride?: { id: string; name: string; code: string }) => {
    const ex = exOverride ?? (editId ? exhibitions.find(e => e.id === editId) : null);
    if (!ex) return;
    setBatchQrLoading(true);
    try {
      // Fetch artworks if not already loaded for this exhibition
      const artworks = (exOverride && exOverride.id !== editId)
        ? await fetch(`/api/artworks?exhibition_id=${exOverride.id}`).then(r => r.json()).then((j: { data?: ArtworkRow[] }) => j.data ?? [])
        : editArtworks;
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const SIZE = 480;

      async function makeQR(url: string, title: string): Promise<string> {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, url, {
          width: SIZE, margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#18181b', light: '#ffffff' },
        });
        const ctx = canvas.getContext('2d')!;
        // Draw center label (same logic as QRCodeDisplay)
        const boxW = SIZE * 0.30, boxH = SIZE * 0.30;
        const bx = (SIZE - boxW) / 2, by = (SIZE - boxH) / 2;
        const r = 6, pad = 7;
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.beginPath();
        ctx.moveTo(bx + r, by); ctx.lineTo(bx + boxW - r, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
        ctx.lineTo(bx + boxW, by + boxH - r);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
        ctx.lineTo(bx + r, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath(); ctx.fill();
        const maxW = boxW - pad * 2;
        const fontFace = '"PingFang TC","Microsoft JhengHei",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let fontSize = 13;
        const wrap = (fs: number) => {
          ctx.font = `bold ${fs}px ${fontFace}`;
          const lines: string[] = []; let cur = '';
          for (const ch of title) {
            if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
            else cur += ch;
          }
          if (cur) lines.push(cur);
          return lines;
        };
        let lines = wrap(fontSize);
        while (lines.length > 3 && fontSize > 8) { fontSize--; lines = wrap(fontSize); }
        ctx.font = `bold ${fontSize}px ${fontFace}`; ctx.fillStyle = '#18181b';
        const lineH = fontSize * 1.35, totalH = lines.length * lineH;
        const startY = SIZE / 2 - totalH / 2 + lineH / 2;
        lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, startY + i * lineH));
        return canvas.toDataURL('image/png').split(',')[1];
      }

      // Exhibition QR
      const exUrl = `${BASE_URL}/exhibition/${ex.code}`;
      const exPng = await makeQR(exUrl, ex.name);
      zip.file(`展覽-${ex.code}.png`, exPng, { base64: true });

      // Artwork QRs
      for (const aw of artworks) {
        const awUrl = `${BASE_URL}/artwork/${aw.code}`;
        const awTitle = aw.title ?? aw.code;
        const awPng = await makeQR(awUrl, awTitle);
        zip.file(`作品-${aw.code}.png`, awPng, { base64: true });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qrcodes-${ex.code}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBatchQrLoading(false);
    }
  };

  const confirmDeleteExecution = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/exhibitions/${confirmDelete.id}`, { method: 'DELETE' });
    setDeleting(false);
    setConfirmDelete(null);
    if (res.ok) window.location.reload();
    else {
      const json = await res.json().catch(() => ({}));
      alert(`刪除失敗：${json.error ?? '請稍後再試'}`);
    }
  };

  return (
    <div>
      {/* 刪除確認 Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-stone-900 mb-2">刪除展覽</h3>
            <p className="text-sm text-stone-600 mb-1">確定要刪除「<span className="font-medium text-stone-900">{confirmDelete.name}</span>」嗎？</p>
            <p className="text-sm text-red-500 mb-6">底下所有作品及相關資料將一併刪除，此操作無法復原。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmDeleteExecution}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? '刪除中…' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !batchQrLoading && setQrModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-stone-900 mb-1">下載 QR Code</h3>
            <p className="text-sm text-stone-500 mb-4">「{qrModal.name}」</p>

            <div className="flex justify-center mb-5">
              <QRCodeDisplay
                url={`${BASE_URL}/exhibition/${qrModal.code}`}
                label={`exhibition-${qrModal.code}`}
                title={qrModal.name}
                size={200}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleBatchQR(qrModal)}
                disabled={batchQrLoading}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {batchQrLoading ? '產生中…' : '⬇ 批次下載（展覽 + 所有作品）'}
              </button>
              <button
                onClick={() => setQrModal(null)}
                className="w-full px-4 py-2 text-sm rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-900">展覽管理</h1>
        <button onClick={openCreate} className="btn-primary">＋ 新增展覽</button>
      </div>

      {batchSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-green-800 text-sm">
          ✓ {batchSuccess}
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">
            {editId ? '編輯展覽' : '新增展覽'}
          </h2>

          {/* Import from URL */}
          {!editId && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
              <p className="text-sm font-medium text-blue-900 mb-1">從網址匯入（選用）</p>
              <p className="text-xs text-blue-600 mb-3">貼上展覽頁網址，自動填入展覽資料與所有作品。</p>
              <div className="flex gap-2">
                <input
                  className="form-input flex-1 text-sm"
                  placeholder="https://www.uniart.com.tw/topics/..."
                  value={importUrl}
                  onChange={e => {
                    const url = e.target.value;
                    setImportUrl(url);
                    setImportedArtworks(null); setImportError(''); setBatchSuccess('');
                    const match = url.trim().match(/\/(\d+)\/?(?:\?.*)?$/);
                    if (match) {
                      setForm(f => (codeAutoFilled || !f.code) ? { ...f, code: match[1] } : f);
                      setCodeAutoFilled(true);
                    }
                  }}
                />
                <button onClick={handleImportUrl} disabled={importing || !importUrl.trim()} className="btn-primary text-sm whitespace-nowrap">
                  {importing ? '解析中…' : '解析'}
                </button>
              </div>
              {importError && <p className="text-red-500 text-xs mt-2">{importError}</p>}

              {/* Artwork preview */}
              {importedArtworks && (
                <div className="mt-3 border-t border-blue-100 pt-3">
                  <p className="text-xs font-medium text-blue-900 mb-2">
                    找到 {importedArtworks.length} 件作品
                  </p>
                  <ul className="space-y-1 mb-3">
                    {importedArtworks.slice(0, 5).map((aw, i) => (
                      <li key={i} className="text-xs text-blue-800 flex gap-2">
                        <span className="text-blue-400">{i + 1}.</span>
                        <span>{aw.title}</span>
                        {aw.artist && <span className="text-blue-500">／{aw.artist}</span>}
                      </li>
                    ))}
                    {importedArtworks.length > 5 && (
                      <li className="text-xs text-blue-400">…還有 {importedArtworks.length - 5} 件</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">展覽代碼 *</label>
              <input className="form-input" placeholder="例：EXPO01" value={form.code}
                onChange={e => { setCodeAutoFilled(false); setForm(f => ({ ...f, code: e.target.value })); }} />
              <p className="text-xs text-stone-400 mt-1">用於 QR Code 網址，建立後建議不要更改</p>
            </div>
          </div>

          {/* Language tabs */}
          <div className="flex items-center gap-1 border-b border-stone-200 mb-4">
            {(['zh', 'en'] as const).map(l => (
              <button key={l} type="button" onClick={() => setFormLang(l)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${formLang === l ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                {l === 'zh' ? '中文' : 'English'}
              </button>
            ))}
          </div>

          {formLang === 'zh' ? (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="form-label">展覽名稱 *</label>
                <input className="form-input" placeholder="例：2024 春季聯展" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">展覽簡介</label>
                <textarea className="form-input" rows={8} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="form-label">Exhibition Name</label>
                <input className="form-input" placeholder="e.g. 2024 Spring Exhibition" value={form.name_en}
                  onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Description (English)</label>
                <textarea className="form-input" rows={8} value={form.description_en}
                  onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Banner image */}
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">橫式封面圖（電腦版）</label>
                {form.cover_image_url && (
                  <img src={form.cover_image_url} alt="封面圖預覽"
                    className="w-full h-auto rounded-xl mb-3" />
                )}
                <input
                  className="form-input text-sm"
                  placeholder="貼上圖片網址（https://...）"
                  value={form.cover_image_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
                />
                <p className="text-xs text-stone-400 mt-1">建議橫式，寬度至少 1200px</p>
              </div>
              <div>
                <label className="form-label">直式封面圖（手機版）</label>
                {form.mobile_cover_image_url && (
                  <img src={form.mobile_cover_image_url} alt="手機封面圖預覽"
                    className="w-full h-auto rounded-xl mb-3" />
                )}
                <input
                  className="form-input text-sm"
                  placeholder="貼上圖片網址（https://...）"
                  value={form.mobile_cover_image_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, mobile_cover_image_url: e.target.value }))}
                />
                <p className="text-xs text-stone-400 mt-1">建議直式，寬度至少 600px；未填則沿用電腦版</p>
              </div>
            </div>
            {editId && (
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-xs text-stone-400">上傳橫式圖片：</span>
                <label className="btn-ghost cursor-pointer text-xs">
                  選擇圖片
                  <input type="file" accept="image/*" className="sr-only"
                    onChange={e => { setImageFile(e.target.files?.[0] ?? null); setImageError(''); }} />
                </label>
                {imageFile && (
                  <>
                    <span className="text-xs text-stone-500">{imageFile.name}</span>
                    <button onClick={() => handleImageUpload(editId)} disabled={imageUploading} className="btn-primary text-xs">
                      {imageUploading ? '上傳中…' : '上傳至 Cloudinary'}
                    </button>
                  </>
                )}
              </div>
            )}
            {imageError && <p className="text-red-500 text-xs mt-1">{imageError}</p>}
          </div>

          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4 flex-wrap">
            {importedArtworks && !editId ? (
              <button onClick={handleBatchImport} disabled={batchSaving} className="btn-primary">
                {batchSaving ? '建立中…' : `一鍵建立展覽 ＋ ${importedArtworks.length} 件作品`}
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? '儲存中…' : '儲存'}
              </button>
            )}
            <button onClick={() => setShowForm(false)} className="btn-ghost">取消</button>
            {editId && (() => {
              const ex = exhibitions.find(e => e.id === editId);
              if (!ex) return null;
              return (
                <a
                  href={`/exhibition/${ex.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost text-sm"
                >
                  前台預覽 ↗
                </a>
              );
            })()}
          </div>

          {/* Artworks for this exhibition */}
          {editId && (
            <div className="mt-8 pt-6 border-t border-stone-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-stone-700">
                  作品明細
                  {editArtworks.length > 0 && (
                    <span className="text-stone-400 font-normal ml-2">{editArtworks.length} 件</span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBatchQR()}
                    disabled={batchQrLoading || editArtworks.length === 0}
                    className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-40"
                  >
                    {batchQrLoading ? '產生中…' : '⬇ 批次下載 QR'}
                  </button>
                  <Link href={`/admin/artworks?exhibition_id=${editId}`}
                    className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-2.5 py-1 transition-colors">
                    管理作品 →
                  </Link>
                </div>
              </div>
              {editArtworksLoading ? (
                <p className="text-stone-400 text-sm py-6 text-center">載入中…</p>
              ) : editArtworks.length === 0 ? (
                <p className="text-stone-400 text-sm py-6 text-center">尚無作品</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {editArtworks.map(aw => (
                    <Link key={aw.id} href={`/admin/artworks/${aw.id}`} className="group block">
                      <div className="w-full bg-stone-50 rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '1/1' }}>
                        {aw.cover_image_url ? (
                          <img src={aw.cover_image_url} alt={aw.title ?? aw.code}
                            className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300 text-xl">♪</div>
                        )}
                      </div>
                      <p className="font-mono text-xs text-stone-400">{aw.code}</p>
                      <p className="text-xs text-stone-800 font-medium line-clamp-2 leading-snug group-hover:underline underline-offset-2">
                        {aw.title ?? '（無標題）'}
                      </p>
                      {aw.artist && <p className="text-xs text-stone-400 mt-0.5">{aw.artist}</p>}
                      {!aw.audio_url && <p className="text-xs text-amber-500 mt-0.5">無音檔</p>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Exhibition grid + artwork list — hidden while form is open */}
      {!showForm && (
        <>
          {exhibitions.length === 0 ? (
            <p className="text-stone-400 text-sm py-12 text-center">尚無展覽，點上方「新增展覽」開始。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {exhibitions.map(ex => {
                return (
                  <div key={ex.id}
                    onClick={() => openEdit(ex)}
                    className="bg-[#faf7f2] border border-stone-200 rounded-2xl overflow-hidden flex flex-col transition-all cursor-pointer hover:border-stone-400 hover:shadow-md">

                    {/* Banner */}
                    <div className="w-full bg-stone-100 flex-shrink-0">
                      {ex.cover_image_url ? (
                        <img src={ex.cover_image_url} alt={ex.name}
                          className="w-full h-auto block" />
                      ) : (
                        <div className="w-full h-36 flex flex-col items-center justify-center gap-2 text-stone-300">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.5"
                            stroke="currentColor" aria-hidden>
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                          <span className="text-xs">尚未上傳封面圖</span>
                        </div>
                      )}
                    </div>

                    {/* Code + Name + actions */}
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md">{ex.code}</span>
                          <h3 className="font-semibold text-stone-900 leading-snug">{ex.name}</h3>
                        </div>
                        {ex.description && (
                          <p className="text-xs text-stone-400 mt-1 line-clamp-2">{ex.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs text-stone-400">{ex.artwork_count} 件作品</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={e => { e.stopPropagation(); setQrModal({ id: ex.id, name: ex.name, code: ex.code }); }}
                            className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-2 py-1 transition-colors">
                            QR
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(ex.id, ex.name); }}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1">
                            刪除
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </>
      )}
    </div>
  );
}
