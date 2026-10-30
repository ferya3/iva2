import { describe, expect, it } from 'vitest';
import { METRIC_LABELS, formatMetric, metricLabel, reportDocumentSchema } from '../src';

describe('report document', () => {
  it('validates a minimal document', () => {
    const doc = {
      schema_version: '1.0',
      report_id: 'r1',
      report_version: 1,
      generated_at: '2026-10-30T08:00:00Z',
      locale: 'fa',
      tenant: { name: 'کلینیک نمونه' },
      patient: { code: 'P-1024', age_years: 11, sex: 'male', handedness: 'right' },
      session: {
        id: 's1',
        assessment_key: 'demo-cpt',
        assessment_name: 'CPT نمایشی',
        assessment_version: '1.0.0',
        is_clinical: false,
        engine_version: '1.0.0',
        started_at: null,
        completed_at: null,
        device: null,
      },
      quality: { validity_status: 'valid', flags: [] },
      scoring: { algorithm_version: 'generic-cpt/1.0.0', scored_at: '2026-10-30T08:10:00Z' },
      sections: [
        {
          key: 'overview',
          title: 'خلاصه',
          metrics: [
            { key: 'hits', label: 'پاسخ صحیح', value: 80, unit: 'count', scope: 'overall' },
          ],
        },
      ],
      disclaimers: ['این گزارش جایگزین قضاوت بالینی نیست.'],
    };
    expect(reportDocumentSchema.safeParse(doc).success).toBe(true);
  });
});

describe('formatting', () => {
  it('uses Persian digits and units', () => {
    expect(formatMetric(412.5, 'ms')).toBe('۴۱۲٫۵ میلی‌ثانیه');
    expect(formatMetric(0.8, 'ratio')).toBe('۸۰٪');
    expect(formatMetric(null, 'ms')).toBe('—');
  });

  it('resolves labels and falls back to the key', () => {
    expect(metricLabel('rt_cv')).toBe(METRIC_LABELS.rt_cv!.fa);
    expect(metricLabel('unknown_metric')).toBe('unknown_metric');
  });
});
