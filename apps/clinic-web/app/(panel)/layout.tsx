import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@cognitest/ui';
import { currentUser } from '@/lib/auth';
import { logout } from '@/features/auth/actions';
import { Sidebar } from '@/components/sidebar';
import { Logo } from '@/components/logo';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { user, membership, memberships } = await currentUser();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 px-5 py-4">
          <Logo />
          <p className="mt-3 truncate text-sm font-medium text-slate-800">{membership.tenant_name}</p>
          {memberships.length > 1 ? (
            <Link href="/select-clinic" className="text-xs text-brand-700 hover:underline">
              تغییر کلینیک
            </Link>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar permissions={membership.permissions} />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="ltr truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="icon" aria-label="خروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
