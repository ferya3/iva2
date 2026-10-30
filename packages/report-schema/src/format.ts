import type { ValidityStatus } from '@cognitest/shared-types';

const faDigits = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const faPercent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });

/** Formats a metric value for display in Persian (Eastern Arabic digits). */
export function formatMetric(value: number | null, unit: string | null, locale: 'fa' | 'en' = 'fa'): string {
  if (value === null) return '—';
  if (locale === 'en') {
    if (unit === 'ratio') return `${(value * 100).toFixed(1)}%`;
    return unit === 'ms' ? `${value.toFixed(1)} ms` : String(Math.round(value * 100) / 100);
  }
  if (unit === 'ratio') return faPercent.format(value);
  if (unit === 'ms') return `${faDigits.format(value)} میلی‌ثانیه`;
  if (unit === 'ms/block') return `${faDigits.format(value)} ms/بلوک`;
  return faDigits.format(value);
}

export const VALIDITY_LABELS: Record<ValidityStatus, { fa: string; en: string; tone: 'ok' | 'warn' | 'bad' }> = {
  valid: { fa: 'معتبر', en: 'Valid', tone: 'ok' },
  questionable: { fa: 'نیازمند بررسی', en: 'Questionable', tone: 'warn' },
  invalid: { fa: 'نامعتبر', en: 'Invalid', tone: 'bad' },
};

/** Persian labels for scoring-engine metric keys (scope-independent). */
export const METRIC_LABELS: Record<string, { fa: string; en: string }> = {
  trials: { fa: 'تعداد کوشش‌ها', en: 'Trials' },
  excluded_trials: { fa: 'کوشش‌های کنارگذاشته', en: 'Excluded trials' },
  targets: { fa: 'محرک‌های هدف', en: 'Targets' },
  non_targets: { fa: 'محرک‌های غیرهدف', en: 'Non-targets' },
  hits: { fa: 'پاسخ صحیح', en: 'Hits' },
  omissions: { fa: 'خطای حذف', en: 'Omissions' },
  commissions: { fa: 'خطای ارتکاب', en: 'Commissions' },
  correct_rejections: { fa: 'بازداری صحیح', en: 'Correct rejections' },
  hit_rate: { fa: 'نرخ پاسخ صحیح', en: 'Hit rate' },
  omission_rate: { fa: 'نرخ خطای حذف', en: 'Omission rate' },
  commission_rate: { fa: 'نرخ خطای ارتکاب', en: 'Commission rate' },
  anticipatory_responses: { fa: 'پاسخ‌های پیش‌دستانه', en: 'Anticipatory responses' },
  repeated_responses: { fa: 'پاسخ‌های تکراری', en: 'Repeated responses' },
  rt_mean: { fa: 'میانگین زمان واکنش', en: 'Mean RT' },
  rt_median: { fa: 'میانه زمان واکنش', en: 'Median RT' },
  rt_sd: { fa: 'انحراف معیار زمان واکنش', en: 'RT SD' },
  rt_cv: { fa: 'ضریب تغییرات زمان واکنش', en: 'RT CV' },
  d_prime: { fa: 'حساسیت (d′)', en: "Sensitivity (d')" },
  criterion_c: { fa: 'ملاک پاسخ (c)', en: 'Criterion (c)' },
  rt_mean_slope_per_block: { fa: 'روند زمان واکنش در طول آزمون', en: 'RT trend per block' },
  hit_rate_slope_per_block: { fa: 'روند دقت در طول آزمون', en: 'Hit-rate trend per block' },
};

export function metricLabel(key: string, locale: 'fa' | 'en' = 'fa'): string {
  return METRIC_LABELS[key]?.[locale] ?? key;
}
