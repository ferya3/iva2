import localFont from 'next/font/local';

// Self-hosted (no Google Fonts dependency — unreliable from Iran).
export const vazirmatn = localFont({
  src: '../node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2',
  variable: '--font-vazirmatn',
  weight: '100 900',
  display: 'swap',
});
