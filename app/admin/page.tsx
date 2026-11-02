'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        const res = await fetch('/api/auth/check', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          router.replace('/admin/exhibitions');
          return;
        }
      }
      setChecking(false);
    });
    return unsub;
  }, [router]);

  const handleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(firebaseAuth, provider);
      const token = await cred.user.getIdToken();
      const res = await fetch('/api/auth/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.replace('/admin/exhibitions');
      } else {
        await firebaseAuth.signOut();
        setError('此帳號沒有後台存取權限。');
      }
    } catch {
      setError('登入失敗，請再試一次。');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className="min-h-screen bg-[#f2ede7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#faf7f2] rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="font-serif text-xl font-bold text-stone-900 mb-1">語音導覽後台</h1>
        <p className="text-sm text-stone-500 mb-8">請用 Google 帳號登入</p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#faf7f2] border border-stone-200 text-stone-800 font-medium py-3 px-4 rounded-xl hover:bg-stone-100 active:bg-stone-200 transition-colors shadow-sm disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? '登入中…' : '使用 Google 帳號登入'}
        </button>

        {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}

        <p className="mt-6 text-xs text-stone-400 text-center leading-relaxed">
          僅限授權的管理員帳號登入。<br />
          第一次登入會看到「未驗證應用程式」的 Google 警告，<br />
          點「進階」→「前往」即可繼續。
        </p>
      </div>
    </div>
  );
}
