'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';
import { cn } from '@cognitest/ui';

const NAV = [
  { href: '/', label: 'داشبورد', icon: LayoutDashboard, exact: true },
  { href: '/patients', label: 'مراجعه‌کنندگان', icon: Users },
  { href: '/sessions/new', label: 'آزمون جدید', icon: PlusCircle, exact: true },
  { href: '/sessions', label: 'جلسات آزمون', icon: ClipboardList },
  { href: '/reports', label: 'نتایج و گزارش‌ها', icon: FileBarChart },
  { href: '/team', label: 'متخصصان', icon: Stethoscope, permission: 'members.manage' },
  { href: '/billing', label: 'اشتراک و پرداخت', icon: CreditCard },
  { href: '/settings', label: 'تنظیمات کلینیک', icon: Settings },
] as const;

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact
      ? pathname === href
      : pathname === href ||
        (pathname.startsWith(href + '/') && !pathname.startsWith('/sessions/new'));

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="منوی اصلی">
      {NAV.filter((item) => !('permission' in item) || permissions.includes(item.permission)).map(
        (item) => {
          const active = isActive(item.href, 'exact' in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        },
      )}
    </nav>
  );
}
