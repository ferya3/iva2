import { z } from 'zod';

export const deviceProfileSchema = z.object({
  os: z.string().max(128),
  os_version: z.string().max(64),
  app_version: z.string().max(32),
  engine_version: z.string().max(32),
  cpu_model: z.string().max(256).nullable(),
  cpu_cores: z.number().int().positive().nullable(),
  memory_gb: z.number().positive().nullable(),
  screen: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    scale_factor: z.number().positive(),
    color_depth: z.number().int().positive(),
  }),
  gpu: z.string().max(256).nullable(),
  audio_output: z.string().max(256).nullable(),
});

export const calibrationResultSchema = z.object({
  display: z.object({
    samples: z.number().int().min(1),
    refresh_rate_hz: z.number().positive(),
    frame_interval_mean_ms: z.number().positive(),
    frame_interval_sd_ms: z.number().min(0),
    frame_interval_p99_ms: z.number().positive(),
    dropped_frame_ratio: z.number().min(0).max(1),
  }),
  input: z.object({
    samples: z.number().int().min(0),
    dispatch_latency_mean_ms: z.number().min(0).nullable(),
    dispatch_latency_p95_ms: z.number().min(0).nullable(),
  }),
  audio: z.object({
    available: z.boolean(),
    sample_rate: z.number().positive().nullable(),
    base_latency_ms: z.number().min(0).nullable(),
    output_latency_ms: z.number().min(0).nullable(),
  }),
  verdict: z.enum(['pass', 'warn', 'fail']),
  reasons: z.array(z.object({ code: z.string(), message: z.string() })),
});

export type DeviceProfileInput = z.input<typeof deviceProfileSchema>;
export type CalibrationResultInput = z.input<typeof calibrationResultSchema>;
