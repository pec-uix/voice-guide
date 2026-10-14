import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/admin');

  return (
    <div className="min-h-screen bg-[#f2ede7]">
      {/* Top nav */}
      <header className="bg-[#faf7f2] border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <a href="/admin/exhibitions" className="font-serif text-sm font-semibold text-stone-800 mr-3 hover:text-stone-600 transition-colors">語音導覽後台</a>
            <NavLink href="/admin/exhibitions">展覽</NavLink>
            <NavLink href="/admin/artworks">作品</NavLink>
            <NavLink href="/admin/dashboard">數據</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 hidden sm:block">
              {session.user?.email}
            </span>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/admin' });
              }}
            >
              <button
                type="submit"
                className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 transition-colors"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
    >
      {children}
    </Link>
  );
}
