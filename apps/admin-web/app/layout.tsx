import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { vazirmatn } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'مدیریت سامانه | Cognitest', template: '%s | مدیریت Cognitest' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
