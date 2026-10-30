import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_BATCH_LIMITS, eventBatchSchema } from '../src';

const fixture = () =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../fixtures/event-batch.valid.json'), 'utf8'));

describe('event batch contract', () => {
  it('accepts the canonical fixture (shared with the API test-suite)', () => {
    expect(eventBatchSchema.safeParse(fixture()).success).toBe(true);
  });

  it('rejects a gap in the sequence', () => {
    const batch = fixture();
    batch.events[2].sequence = 9;
    const result = eventBatchSchema.safeParse(batch);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/contiguous/);
  });

  it('rejects decreasing timestamps', () => {
    const batch = fixture();
    batch.events[3].timestamp_ms = 1;
    expect(eventBatchSchema.safeParse(batch).success).toBe(false);
  });

  it('rejects unknown event types', () => {
    const batch = fixture();
    batch.events[1].type = 'keylogger_dump';
    expect(eventBatchSchema.safeParse(batch).success).toBe(false);
  });

  it('enforces the batch size limit', () => {
    const batch = fixture();
    const marker = (sequence: number) => ({ sequence, type: 'marker', timestamp_ms: 2000, label: 'x' });
    batch.events = Array.from({ length: EVENT_BATCH_LIMITS.maxEvents + 1 }, (_, i) => marker(i + 1));
    expect(eventBatchSchema.safeParse(batch).success).toBe(false);
  });

  it('rejects a non-uuid batch id', () => {
    const batch = fixture();
    batch.batch_id = 'batch-1';
    expect(eventBatchSchema.safeParse(batch).success).toBe(false);
  });
});
