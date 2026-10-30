import { z } from 'zod';
import { EventType } from '@cognitest/shared-types';
import { EVENT_BATCH_LIMITS } from './limits';

const ms = z.number().finite().min(0).max(EVENT_BATCH_LIMITS.maxTimestampMs);
const shortText = z.string().min(1).max(EVENT_BATCH_LIMITS.maxStringLength);
const index = z.number().int().min(0);

const base = {
  sequence: z.number().int().min(1),
  timestamp_ms: ms,
};

export const sessionStartedSchema = z.object({
  ...base,
  type: z.literal(EventType.SessionStarted),
  engine_version: shortText,
  protocol_key: shortText,
  protocol_version: shortText,
  seed: z.number().int().min(0).max(2 ** 32 - 1),
  wall_clock_iso: z.iso.datetime({ offset: true }),
});

export const sessionEndedSchema = z.object({
  ...base,
  type: z.literal(EventType.SessionEnded),
  reason: z.enum(['completed', 'aborted']),
});

export const blockStartedSchema = z.object({
  ...base,
  type: z.literal(EventType.BlockStarted),
  block_index: index,
  block_key: shortText,
});

export const blockEndedSchema = z.object({
  ...base,
  type: z.literal(EventType.BlockEnded),
  block_index: index,
});

export const stimulusPresentedSchema = z.object({
  ...base,
  type: z.literal(EventType.StimulusPresented),
  trial_index: index,
  block_index: index,
  stimulus_id: shortText,
  modality: z.enum(['visual', 'auditory']),
  is_target: z.boolean(),
  planned_time_ms: ms,
  actual_time_ms: ms,
  frame_number: index.nullable(),
  presentation_status: z.enum(['on_time', 'late', 'dropped']),
});

export const stimulusClearedSchema = z.object({
  ...base,
  type: z.literal(EventType.StimulusCleared),
  trial_index: index,
});

export const responseSchema = z.object({
  ...base,
  type: z.literal(EventType.Response),
  received_time_ms: ms,
  input: z.enum(['keyboard', 'mouse']),
  key: shortText,
  stimulus_sequence: z.number().int().min(1).nullable(),
  reaction_time_ms: z.number().finite().nullable(),
  validity: z.enum(['valid', 'anticipatory', 'late', 'unmatched']),
});

const simple = <T extends string>(type: T) => z.object({ ...base, type: z.literal(type) });

export const frameDropSchema = z.object({
  ...base,
  type: z.literal(EventType.FrameDrop),
  expected_interval_ms: z.number().positive(),
  observed_interval_ms: z.number().positive(),
  dropped_frames: z.number().int().min(1),
});

export const audioErrorSchema = z.object({
  ...base,
  type: z.literal(EventType.AudioError),
  message: z.string().max(1024),
});

export const markerSchema = z.object({
  ...base,
  type: z.literal(EventType.Marker),
  label: shortText,
});

export const sessionEventSchema = z.discriminatedUnion('type', [
  sessionStartedSchema,
  sessionEndedSchema,
  blockStartedSchema,
  blockEndedSchema,
  stimulusPresentedSchema,
  stimulusClearedSchema,
  responseSchema,
  simple(EventType.FocusLost),
  simple(EventType.FocusGained),
  simple(EventType.VisibilityHidden),
  simple(EventType.VisibilityVisible),
  frameDropSchema,
  audioErrorSchema,
  markerSchema,
]);

export const eventBatchSchema = z
  .object({
    session_id: z.uuid(),
    batch_id: z.uuid(),
    engine_version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/),
    events: z.array(sessionEventSchema).min(1).max(EVENT_BATCH_LIMITS.maxEvents),
  })
  .superRefine((batch, ctx) => {
    for (let i = 1; i < batch.events.length; i++) {
      const prev = batch.events[i - 1]!;
      const curr = batch.events[i]!;
      if (curr.sequence !== prev.sequence + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', i, 'sequence'],
          message: `sequence must be contiguous: expected ${prev.sequence + 1}, got ${curr.sequence}`,
        });
      }
      if (curr.timestamp_ms < prev.timestamp_ms) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', i, 'timestamp_ms'],
          message: 'timestamps must be non-decreasing',
        });
      }
    }
  });

export type EventBatchInput = z.input<typeof eventBatchSchema>;
