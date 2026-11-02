'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        router.replace('/admin');
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await signOut(firebaseAuth);
        router.replace('/admin');
        return;
      }
      setEmail(user.email);
      setChecking(false);
    });
    return unsub;
  }, [router]);

  if (checking) return null;

  return (
    <div className="min-h-screen bg-[#f2ede7]">
      <header className="bg-[#faf7f2] border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <a href="/admin/exhibitions" className="font-serif text-sm font-semibold text-stone-800 mr-3 hover:text-stone-600 transition-colors">語音導覽後台</a>
            <NavLink href="/admin/exhibitions">展覽</NavLink>
            <NavLink href="/admin/artworks">作品</NavLink>
            <NavLink href="/admin/dashboard">數據</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 hidden sm:block">{email}</span>
            <button
              type="button"
              onClick={() => signOut(firebaseAuth).then(() => router.replace('/admin'))}
              className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
    >
      {children}
    </a>
  );
}
