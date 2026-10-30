import type { CognitestBridge } from '../../electron/ipc-contract';

declare global {
  interface Window {
    cognitest: CognitestBridge;
  }
}

export const bridge = (): CognitestBridge => window.cognitest;

/** Compares dotted versions numerically: -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

export const ERROR_MESSAGES: Record<string, string> = {
  network: 'اتصال به سرور برقرار نشد. اتصال اینترنت را بررسی کنید.',
  invalid_invite: 'کد وارد شده نامعتبر یا منقضی است.',
  session_not_joinable: 'این جلسه دیگر قابل ورود نیست. از متخصص کد جدید بخواهید.',
  invalid_session_transition: 'این مرحله در وضعیت فعلی جلسه امکان‌پذیر نیست.',
  upload_pending: 'ارسال داده‌های آزمون قبلی هنوز کامل نشده است.',
  player_unauthenticated: 'اعتبار ورود منقضی شده است. دوباره کد را وارد کنید.',
};

export const errorMessage = (code: string, fallback: string) => ERROR_MESSAGES[code] ?? fallback;
