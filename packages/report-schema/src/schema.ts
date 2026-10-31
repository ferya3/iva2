import { z } from 'zod';

/** 1.1 adds norm comparison (metric.norm, norms) and session.audience; 1.0 reports stay valid. */
export const REPORT_SCHEMA_VERSION = '1.1';

export const NORM_BANDS = ['very_low', 'low', 'average', 'high', 'very_high'] as const;
export type NormBand = (typeof NORM_BANDS)[number];

/**
 * Comparison with the age (and sex) band of a norm set. Oriented so that a
 * higher standard score (mean 100, SD 15) means better performance, except
 * for `neutral` metrics where it only describes the value.
 */
export const metricNormSchema = z.object({
  z: z.number(),
  standard_score: z.number(),
  percentile: z.number(),
  band: z.enum(NORM_BANDS),
  band_label: z.string().optional(),
  direction: z.enum(['higher_better', 'lower_better', 'neutral']),
  n: z.number().int(),
  age_band: z.string(),
  sex: z.string(),
});

export const reportMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  scope: z.string(),
  norm: metricNormSchema.nullable().optional(),
});

export const reportNormsSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  provisional: z.boolean(),
  source: z.string().nullable(),
  age_years: z.number().int(),
  sex: z.string().nullable(),
});

export const qualityFlagSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  value: z.number().optional().nullable(),
  threshold: z.number().optional().nullable(),
});

export const reportSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  metrics: z.array(reportMetricSchema),
});

/**
 * The persisted report document (reports.content). Rendered identically by
 * the clinic panel and by the PDF template; immutable per report_version.
 */
export const reportDocumentSchema = z.object({
  schema_version: z.enum(['1.0', REPORT_SCHEMA_VERSION]),
  report_id: z.string(),
  report_version: z.number().int().min(1),
  generated_at: z.string(),
  locale: z.enum(['fa', 'en']),
  tenant: z.object({ name: z.string() }),
  patient: z.object({
    code: z.string(),
    age_years: z.number().nullable(),
    sex: z.string().nullable(),
    handedness: z.string().nullable(),
  }),
  session: z.object({
    id: z.string(),
    assessment_key: z.string(),
    assessment_name: z.string(),
    assessment_version: z.string(),
    is_clinical: z.boolean(),
    audience: z.string().nullable().optional(),
    age_range: z.string().nullable().optional(),
    engine_version: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    device: z.record(z.string(), z.unknown()).nullable(),
  }),
  quality: z.object({
    validity_status: z.enum(['valid', 'questionable', 'invalid']),
    flags: z.array(qualityFlagSchema),
  }),
  scoring: z.object({
    algorithm_version: z.string(),
    scored_at: z.string(),
  }),
  norms: reportNormsSchema.nullable().optional(),
  sections: z.array(reportSectionSchema),
  disclaimers: z.array(z.string()),
});

export type ReportDocument = z.infer<typeof reportDocumentSchema>;
export type ReportMetric = z.infer<typeof reportMetricSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type MetricNorm = z.infer<typeof metricNormSchema>;
export type ReportNorms = z.infer<typeof reportNormsSchema>;
