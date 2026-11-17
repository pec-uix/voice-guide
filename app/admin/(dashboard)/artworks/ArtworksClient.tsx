'use client';
import { authFetch } from '@/lib/auth-fetch';

import { useState, useMemo, useRef } from 'react';
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch audio upload
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ code: string; title: string; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }[]>([]);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const { matched, unmatched } = useMemo(() => {
    const titleMap = new Map(artworks.filter(a => a.title).map(a => [a.title!.toLowerCase(), a]));
    const matched: { file: File; artwork: Artwork }[] = [];
    const unmatched: File[] = [];
    for (const f of batchFiles) {
      const name = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
      const aw = titleMap.get(name);
      if (aw) matched.push({ file: f, artwork: aw });
      else unmatched.push(f);
    }
    return { matched, unmatched };
  }, [batchFiles, artworks]);

  const closeBatch = () => { setBatchOpen(false); setBatchFiles([]); setBatchProgress([]); setBatchUploading(false); };

  const handleBatchUpload = async () => {
    if (!matched.length) return;
    setBatchUploading(true);
    setBatchProgress(matched.map(m => ({ code: m.artwork.code, title: m.artwork.title ?? m.artwork.code, status: 'pending' as const })));
    for (let i = 0; i < matched.length; i++) {
      const { file, artwork } = matched[i];
      setBatchProgress(p => p.map((item, idx) => idx === i ? { ...item, status: 'uploading' as const } : item));
      try {
        const fd = new FormData();
        fd.append('audio', file);
        fd.append('lang', 'zh-TW');
        const res = await authFetch(`/api/artworks/${artwork.id}/audio`, { method: 'POST', body: fd });
        if (res.ok) {
          setBatchProgress(p => p.map((item, idx) => idx === i ? { ...item, status: 'done' as const } : item));
        } else {
          const json = await res.json().catch(() => ({}));
          setBatchProgress(p => p.map((item, idx) => idx === i ? { ...item, status: 'error' as const, error: json.error ?? '上傳失敗' } : item));
        }
      } catch {
        setBatchProgress(p => p.map((item, idx) => idx === i ? { ...item, status: 'error' as const, error: '網路錯誤' } : item));
      }
    }
    setBatchUploading(false);
  };

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
      const res = await authFetch('/api/artworks', {
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

  const handleDelete = (id: string, title: string) => setConfirmDelete({ id, title });

  const confirmDeleteExecution = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await authFetch(`/api/artworks/${confirmDelete.id}`, { method: 'DELETE' });
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
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-stone-900 mb-2">刪除作品</h3>
            <p className="text-sm text-stone-600 mb-1">確定要刪除「<span className="font-medium text-stone-900">{confirmDelete.title}</span>」嗎？</p>
            <p className="text-sm text-red-500 mb-6">逐字稿、翻譯及相關資料將一併刪除，此操作無法復原。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50">
                取消
              </button>
              <button onClick={confirmDeleteExecution} disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? '刪除中…' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-stone-900">作品管理</h1>
        <div className="flex gap-2">
          <button onClick={() => { setBatchOpen(o => !o); setBatchFiles([]); setBatchProgress([]); }}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-stone-100 text-stone-700 border border-stone-300 hover:bg-stone-200 hover:border-stone-400 transition-colors">
            <span className="text-base leading-none">↑</span> 批次上傳音檔
          </button>
          <button onClick={openCreate} className="btn-primary">＋ 新增作品</button>
        </div>
      </div>

      {/* Batch audio upload panel */}
      {batchOpen && (
        <div className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-stone-900">批次上傳音檔</h2>
            <button onClick={closeBatch} className="text-stone-400 hover:text-stone-600 text-sm">✕ 關閉</button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
            <p className="text-sm font-medium text-blue-900 mb-1.5">音檔命名規則</p>
            <p className="text-sm text-blue-800 mb-1">每個音檔的<strong>檔名（不含副檔名）必須與作品名稱完全相符</strong>，系統才能自動配對。</p>
            <p className="text-sm text-blue-800 mb-3">不分大小寫，支援 mp3、m4a、wav 等格式。</p>
            {artworks.filter(a => a.title).length > 0 ? (
              <div className="bg-white rounded-lg p-3 font-mono text-xs text-stone-700 space-y-1">
                <p className="text-stone-400 mb-1">目前作品名稱範例：</p>
                {artworks.filter(a => a.title).slice(0, 4).map(aw => (
                  <p key={aw.id}><span className="text-green-600">{aw.title}.mp3</span></p>
                ))}
                {artworks.length > 4 && <p className="text-stone-400">…共 {artworks.length} 件</p>}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-3 font-mono text-xs text-stone-600">
                <p className="text-stone-400 mb-1">命名範例：</p>
                <p><span className="text-green-600">無題之境.mp3</span></p>
                <p><span className="text-green-600">光之流動.m4a</span></p>
              </div>
            )}
            {filter && (
              <p className="text-xs text-blue-600 mt-2">目前已篩選展覽，只會比對目前顯示的 {artworks.length} 件作品。</p>
            )}
          </div>

          {/* File picker → preview → progress */}
          {batchProgress.length === 0 ? (
            <>
              <input ref={batchInputRef} type="file" accept="audio/*" multiple className="hidden"
                onChange={e => { setBatchFiles(Array.from(e.target.files ?? [])); if (batchInputRef.current) batchInputRef.current.value = ''; }} />
              <button onClick={() => batchInputRef.current?.click()}
                className="w-full border-2 border-dashed border-stone-200 rounded-xl py-5 text-sm text-stone-500 hover:bg-stone-50 hover:border-stone-300 transition-colors mb-4">
                {batchFiles.length > 0 ? `已選 ${batchFiles.length} 個檔案（點此重選）` : '點此選擇音檔（可複選）'}
              </button>

              {batchFiles.length > 0 && (
                <>
                  {matched.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-green-700 mb-2">✓ 配對成功 {matched.length} 件</p>
                      <div className="space-y-1">
                        {matched.map(({ file, artwork }) => (
                          <div key={artwork.id} className="flex items-center gap-2 text-xs bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            <span className="font-mono text-green-700 shrink-0">{file.name}</span>
                            <span className="text-stone-300">→</span>
                            <span className="text-stone-700 truncate">{artwork.title ?? artwork.code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {unmatched.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-amber-700 mb-2">⚠ 找不到對應作品，將略過（{unmatched.length} 個）</p>
                      <div className="space-y-1">
                        {unmatched.map(f => (
                          <div key={f.name} className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{f.name}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {matched.length > 0 && (
                    <button onClick={handleBatchUpload} disabled={batchUploading} className="btn-primary mt-1">
                      開始上傳 {matched.length} 個音檔
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <div>
              <p className="text-sm font-medium text-stone-700 mb-3">
                {batchUploading
                  ? `上傳中…（${batchProgress.filter(p => p.status === 'done').length} / ${batchProgress.length}）`
                  : `完成：${batchProgress.filter(p => p.status === 'done').length} 成功，${batchProgress.filter(p => p.status === 'error').length} 失敗`}
              </p>
              <div className="space-y-1.5">
                {batchProgress.map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                    item.status === 'done' ? 'bg-green-50 border border-green-100' :
                    item.status === 'error' ? 'bg-red-50 border border-red-100' :
                    item.status === 'uploading' ? 'bg-blue-50 border border-blue-100' :
                    'bg-stone-50 border border-stone-100'
                  }`}>
                    <span className="shrink-0 w-4 text-center">
                      {item.status === 'pending' ? '·' : item.status === 'uploading' ? '⏳' : item.status === 'done' ? '✓' : '✕'}
                    </span>
                    <span className="font-mono text-stone-600 shrink-0">{item.code}</span>
                    <span className="text-stone-500 truncate">{item.title}</span>
                    {item.error && <span className="text-red-500 ml-auto shrink-0">{item.error}</span>}
                  </div>
                ))}
              </div>
              {!batchUploading && (
                <div className="flex gap-2 mt-4">
                  <button onClick={closeBatch} className="btn-ghost text-sm">關閉</button>
                  <button onClick={() => { setBatchFiles([]); setBatchProgress([]); }} className="btn-ghost text-sm">重新選擇</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
        <div className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">新增作品</h2>
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
          <p className="text-xs text-stone-400 mt-2">
            儲存後，系統會自動把中文內容翻譯成英文草稿（需要校對）
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
        <p className="text-stone-400 text-sm py-12 text-center">尚無作品</p>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden flex flex-col gap-3">
            {artworks.map(aw => {
              const exhibitionName = aw.exhibition_id
                ? (exhibitions.find(ex => ex.id === aw.exhibition_id)?.name ?? '—')
                : null;
              return (
                <div key={aw.id} className="bg-[#faf7f2] border border-stone-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 text-base leading-snug">{aw.title ?? '（無標題）'}</p>
                      {aw.artist && <p className="text-sm text-stone-500 mt-0.5">{aw.artist}</p>}
                    </div>
                    <span className="font-mono text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">{aw.code}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 mb-3">
                    {exhibitionName
                      ? <span>{exhibitionName}</span>
                      : <span className="text-stone-300">未歸屬展覽</span>}
                    {aw.pending_count > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                        待校對 {aw.pending_count}
                      </span>
                    ) : (
                      <span className="text-stone-400">翻譯已完成</span>
                    )}
                  </div>
                  <div className="flex gap-2 border-t border-stone-100 pt-3">
                    <Link href={`/admin/artworks/${aw.id}`} className="btn-ghost text-xs flex-1 text-center">編輯</Link>
                    <button onClick={() => handleDelete(aw.id, aw.title ?? aw.code)}
                      className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-xl border border-red-100 hover:bg-red-50 transition-colors">
                      刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-[#faf7f2] border border-stone-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">代碼</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">作品名稱</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">藝術家</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">所屬展覽</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-stone-500">翻譯狀態</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {artworks.map(aw => (
                  <tr key={aw.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{aw.code}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-900">{aw.title ?? '（無標題）'}</td>
                    <td className="px-4 py-3 text-stone-500">{aw.artist ?? '—'}</td>
                    <td className="px-4 py-3 text-stone-500">
                      {aw.exhibition_id
                        ? (exhibitions.find(ex => ex.id === aw.exhibition_id)?.name ?? '—')
                        : <span className="text-xs text-stone-300">未歸屬</span>}
                    </td>
                    <td className="px-4 py-3">
                      {aw.pending_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                          待校對 {aw.pending_count}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">已完成</span>
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
        </>
      )}
    </div>
  );
}
