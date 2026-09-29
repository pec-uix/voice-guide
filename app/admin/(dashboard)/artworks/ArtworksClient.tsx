'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Artwork {
  id: string;
  code: string;
  artist: string | null;
  year: string | null;
  exhibition_id: string | null;
  cover_image_url: string | null;
  updated_at: string;
  title: string | null;
  pending_count: number;
}

interface Exhibition {
  id: string;
  code: string;
  name: string;
}

interface Props {
  artworks: Artwork[];
  exhibitions: Exhibition[];
  initialExhibitionId: string | null;
}

function emptyForm(exhibitionId: string | null) {
  return { exhibition_id: exhibitionId ?? '', code: '', artist: '', year: '', title: '', description: '', purchase_url: '' };
}

export default function ArtworksClient({ artworks: initial, exhibitions, initialExhibitionId }: Props) {
  const router = useRouter();
  const [artworks, setArtworks] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm(initialExhibitionId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(initialExhibitionId ?? '');

  const openCreate = () => { setForm(emptyForm(filter)); setError(''); setShowForm(true); };

  const handleFilterChange = (val: string) => {
    setFilter(val);
    const url = val ? `/admin/artworks?exhibition_id=${val}` : '/admin/artworks';
    router.push(url);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.title.trim()) { setError('代碼和標題（中文）為必填'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          exhibition_id: form.exhibition_id || null,
          artist: form.artist || null,
          year: form.year || null,
          description: form.description || null,
          purchase_url: form.purchase_url || null,
        }),
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

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除「${title}」？相關逐字稿和翻譯也會一併刪除。`)) return;
    const res = await fetch(`/api/artworks/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('刪除失敗');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">作品管理</h1>
        <button onClick={openCreate} className="btn-primary">＋ 新增作品</button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select value={filter} onChange={e => handleFilterChange(e.target.value)}
          className="form-input w-auto text-sm">
          <option value="">全部展覽</option>
          {exhibitions.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">新增作品</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">作品代碼 *</label>
              <input className="form-input" placeholder="例：A01" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">所屬展覽</label>
              <select className="form-input" value={form.exhibition_id}
                onChange={e => setForm(f => ({ ...f, exhibition_id: e.target.value }))}>
                <option value="">不指定</option>
                {exhibitions.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">藝術家</label>
              <input className="form-input" value={form.artist}
                onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">年代</label>
              <input className="form-input" placeholder="例：2024" value={form.year}
                onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">中文標題 *</label>
              <input className="form-input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">中文介紹</label>
              <textarea className="form-input" rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">購買連結</label>
              <input className="form-input" placeholder="https://..." value={form.purchase_url}
                onChange={e => setForm(f => ({ ...f, purchase_url: e.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            儲存後，系統會自動把中文內容翻譯成英文和日文草稿（需要校對）
          </p>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? '儲存中…' : '儲存並自動翻譯'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">取消</button>
          </div>
        </div>
      )}

      {/* Artwork list */}
      {artworks.length === 0 ? (
        <p className="text-zinc-400 text-sm py-12 text-center">尚無作品</p>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">代碼</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">作品名稱</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">藝術家</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">翻譯狀態</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {artworks.map(aw => (
                <tr key={aw.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{aw.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{aw.title ?? '（無標題）'}</td>
                  <td className="px-4 py-3 text-zinc-500">{aw.artist ?? '—'}</td>
                  <td className="px-4 py-3">
                    {aw.pending_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                        待校對 {aw.pending_count}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">已完成</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/admin/artworks/${aw.id}`} className="btn-ghost text-xs">編輯</Link>
                      <button onClick={() => handleDelete(aw.id, aw.title ?? aw.code)}
                        className="text-xs text-red-500 hover:text-red-700">刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
