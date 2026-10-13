'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCodeDisplay from '@/components/QRCodeDisplay';

interface Exhibition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  review_url: string | null;
  artwork_count: number;
  created_at: string;
}

interface ImportedArtwork {
  productId?: number;
  title: string;
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
  return { code: '', name: '', description: '', review_url: '' };
}

export default function ExhibitionsClient({ exhibitions: initial }: Props) {
  const router = useRouter();
  const [exhibitions, setExhibitions] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importedArtworks, setImportedArtworks] = useState<ImportedArtwork[] | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchSuccess, setBatchSuccess] = useState('');

  const resetImport = () => {
    setImportUrl('');
    setImportError('');
    setImportedArtworks(null);
    setBatchSuccess('');
  };

  const openCreate = () => {
    setEditId(null); setForm(emptyForm()); setError(''); setShowForm(true);
    resetImport();
  };
  const openEdit = (ex: Exhibition) => {
    setEditId(ex.id);
    setForm({ code: ex.code, name: ex.name, description: ex.description ?? '', review_url: ex.review_url ?? '' });
    setError('');
    setShowForm(true);
    resetImport();
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
      if (d.name) setForm(f => ({ ...f, name: d.name }));
      if (d.description) setForm(f => ({ ...f, description: d.description }));
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
          description: form.description || null,
          artworks: importedArtworks,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? '批次建立失敗'); return; }
      setBatchSuccess(`已建立展覽「${form.name}」及 ${json.data.artworksCreated} 件作品`);
      setShowForm(false);
      resetImport();
      router.refresh();
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
      setShowForm(false);
      router.refresh();
    } catch {
      setError('網路錯誤');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」嗎？底下的作品不會被刪除，但會解除與展覽的關聯。`)) return;
    const res = await fetch(`/api/exhibitions/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('刪除失敗');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">展覽管理</h1>
        <button onClick={openCreate} className="btn-primary">＋ 新增展覽</button>
      </div>

      {batchSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-green-800 text-sm">
          ✓ {batchSuccess}
        </div>
      )}

      {/* Form panel */}
      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">
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
                  onChange={e => { setImportUrl(e.target.value); setImportedArtworks(null); setImportError(''); setBatchSuccess(''); }}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">展覽代碼 *</label>
              <input className="form-input" placeholder="例：EXPO01" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              <p className="text-xs text-zinc-400 mt-1">用於 QR Code 網址，建立後建議不要更改</p>
            </div>
            <div>
              <label className="form-label">展覽名稱 *</label>
              <input className="form-input" placeholder="例：2024 春季聯展" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">展覽簡介</label>
              <textarea className="form-input" rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">評價連結（Google 評價等）</label>
              <input className="form-input" placeholder="https://..." value={form.review_url}
                onChange={e => setForm(f => ({ ...f, review_url: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
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
          </div>
        </div>
      )}

      {/* Exhibition list */}
      {exhibitions.length === 0 ? (
        <p className="text-zinc-400 text-sm py-12 text-center">尚無展覽，點上方「新增展覽」開始。</p>
      ) : (
        <div className="space-y-3">
          {exhibitions.map(ex => (
            <div key={ex.id} className="bg-white border border-zinc-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md">{ex.code}</span>
                    <h3 className="font-semibold text-zinc-900">{ex.name}</h3>
                  </div>
                  {ex.description && <p className="text-sm text-zinc-500 mt-1 line-clamp-1">{ex.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-zinc-400">{ex.artwork_count} 件作品</span>
                    <Link href={`/admin/artworks?exhibition_id=${ex.id}`} className="text-xs text-blue-600 hover:underline">
                      查看作品
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setQrId(qrId === ex.id ? null : ex.id)}
                    className="btn-ghost text-xs">QR Code</button>
                  <button onClick={() => openEdit(ex)} className="btn-ghost text-xs">編輯</button>
                  <button onClick={() => handleDelete(ex.id, ex.name)}
                    className="text-xs text-red-500 hover:text-red-700 border border-transparent hover:border-red-200 rounded-lg px-2 py-1 transition-colors">刪除</button>
                </div>
              </div>

              {/* QR Code panel */}
              {qrId === ex.id && (
                <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap gap-6 items-start">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 mb-2">展覽入口 QR Code</p>
                    <QRCodeDisplay
                      url={`${BASE_URL}/exhibition/${ex.code}`}
                      label={`exhibition-${ex.code}`}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
