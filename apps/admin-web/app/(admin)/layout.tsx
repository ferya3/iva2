import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@cognitest/ui';
import { Nav } from '@/components/nav';
import { Logo } from '@/components/logo';
import { logout } from '@/features/auth/actions';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-5 py-5">
          <Logo className="!text-white" />
          <p className="mt-1 text-xs text-slate-400">مدیریت سامانه</p>
        </div>
        <div className="flex-1">
          <Nav />
        </div>
        <form action={logout} className="p-3">
          <Button type="submit" variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> خروج
          </Button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
