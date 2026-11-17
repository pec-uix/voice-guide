'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';

const CACHE_KEY = 'vg_admin_verified';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const verified = useRef(false);

  useEffect(() => {
    // Check sessionStorage cache first to avoid round-trip on every hard refresh
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { email: cachedEmail, exp } = JSON.parse(cached) as { email: string; exp: number };
        if (Date.now() < exp) {
          setEmail(cachedEmail);
          setChecking(false);
          verified.current = true;
        }
      } catch { /* ignore */ }
    }

    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        sessionStorage.removeItem(CACHE_KEY);
        router.replace('/admin');
        return;
      }
      // Skip API check if already verified in this session
      if (verified.current) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        sessionStorage.removeItem(CACHE_KEY);
        await signOut(firebaseAuth);
        router.replace('/admin');
        return;
      }
      const e = user.email ?? '';
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ email: e, exp: Date.now() + CACHE_TTL }));
      verified.current = true;
      setEmail(e);
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
            <Link href="/admin/exhibitions" className="font-serif text-sm font-semibold text-stone-800 mr-3 hover:text-stone-600 transition-colors">
              語音導覽後台
            </Link>
            <NavLink href="/admin/exhibitions">展覽</NavLink>
            <NavLink href="/admin/artworks">作品</NavLink>
            <NavLink href="/admin/dashboard">數據</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 hidden sm:block">{email}</span>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(CACHE_KEY);
                signOut(firebaseAuth).then(() => router.replace('/admin'));
              }}
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
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
        active ? 'text-stone-900 bg-stone-100 font-medium' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
      }`}
    >
      {children}
    </Link>
  );
}
