import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { vazirmatn } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'پنل کلینیک | Cognitest', template: '%s | Cognitest' },
  description: 'پنل مدیریت ارزیابی‌های شناختی کلینیک',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
