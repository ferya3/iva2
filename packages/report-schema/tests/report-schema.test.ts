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

  it('validates a 1.1 document with norm comparisons', () => {
    const doc = {
      schema_version: '1.1',
      report_id: 'r2',
      report_version: 1,
      generated_at: '2026-10-31T08:00:00Z',
      locale: 'fa',
      tenant: { name: 'کلینیک نمونه' },
      patient: { code: 'P-1025', age_years: 7, sex: 'female', handedness: null },
      session: {
        id: 's2',
        assessment_key: 'demo-cpt',
        assessment_name: 'CPT نمایشی',
        assessment_version: '1.1.0-child',
        is_clinical: false,
        audience: 'کودکان ۶ تا ۸ سال',
        age_range: '6–8 سال',
        engine_version: '1.1.0',
        started_at: null,
        completed_at: null,
        device: null,
      },
      quality: { validity_status: 'valid', flags: [] },
      scoring: { algorithm_version: 'generic-cpt/1.0.0', scored_at: '2026-10-31T08:10:00Z' },
      norms: {
        id: 'n1',
        name: 'هنجار مقدماتی',
        version: '0.1',
        provisional: true,
        source: null,
        age_years: 7,
        sex: 'female',
      },
      sections: [
        {
          key: 'overview',
          title: 'خلاصه',
          metrics: [
            {
              key: 'rt_mean',
              label: 'میانگین زمان واکنش',
              value: 612,
              unit: 'ms',
              scope: 'overall',
              norm: {
                z: 0.4,
                standard_score: 106,
                percentile: 65.5,
                band: 'average',
                band_label: 'در محدودهٔ میانگین',
                direction: 'lower_better',
                n: 80,
                age_band: '6–8',
                sex: 'all',
              },
            },
            {
              key: 'trials',
              label: 'کوشش‌ها',
              value: 140,
              unit: 'count',
              scope: 'overall',
              norm: null,
            },
          ],
        },
      ],
      disclaimers: [],
    };
    expect(reportDocumentSchema.safeParse(doc).success).toBe(true);
    expect(
      reportDocumentSchema.safeParse({ ...doc, norms: { ...doc.norms, provisional: 'yes' } })
        .success,
    ).toBe(false);
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
