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

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setError(''); setShowForm(true); };
  const openEdit = (ex: Exhibition) => {
    setEditId(ex.id);
    setForm({ code: ex.code, name: ex.name, description: ex.description ?? '', review_url: ex.review_url ?? '' });
    setError('');
    setShowForm(true);
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

      {/* Form panel */}
      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">
            {editId ? '編輯展覽' : '新增展覽'}
          </h2>
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
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? '儲存中…' : '儲存'}
            </button>
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
