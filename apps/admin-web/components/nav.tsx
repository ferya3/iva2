'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenCheck, Building2, CreditCard, LayoutDashboard, ScrollText, UserCog } from 'lucide-react';
import { cn } from '@cognitest/ui';

const NAV = [
  { href: '/', label: 'نمای کلی', icon: LayoutDashboard },
  { href: '/tenants', label: 'کلینیک‌ها', icon: Building2 },
  { href: '/plans', label: 'پلن‌های اشتراک', icon: CreditCard },
  { href: '/assessments', label: 'کاتالوگ آزمون‌ها', icon: BookOpenCheck },
  { href: '/users', label: 'کاربران', icon: UserCog },
  { href: '/audit', label: 'گزارش رویدادها', icon: ScrollText },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', active ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
