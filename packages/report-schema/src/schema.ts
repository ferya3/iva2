import { z } from 'zod';

export const REPORT_SCHEMA_VERSION = '1.0';

export const reportMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  scope: z.string(),
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
  schema_version: z.literal(REPORT_SCHEMA_VERSION),
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
  sections: z.array(reportSectionSchema),
  disclaimers: z.array(z.string()),
});

export type ReportDocument = z.infer<typeof reportDocumentSchema>;
export type ReportMetric = z.infer<typeof reportMetricSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
