/**
 * Contract test-suite for OutboxStore implementations. The desktop player
 * runs it against its encrypted SQLite store so both stay interchangeable.
 */
import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@cognitest/shared-types';
import type { OutboxStore } from './outbox';

export const marker = (sequence: number): SessionEvent => ({
  sequence,
  type: 'marker',
  timestamp_ms: sequence * 10,
  label: `m${sequence}`,
});

export function outboxContractTests(name: string, factory: () => OutboxStore): void {
  describe(`${name} (OutboxStore contract)`, () => {
    const sid = 'session-a';

    it('returns null when nothing is pending', () => {
      expect(factory().nextBatch(sid, 10)).toBeNull();
    });

    it('enforces gap-free appends', () => {
      const store = factory();
      store.append(sid, marker(1));
      expect(() => store.append(sid, marker(3))).toThrow();
    });

    it('keeps the same batch id and contents until acked', () => {
      const store = factory();
      for (let i = 1; i <= 5; i++) store.append(sid, marker(i));
      const first = store.nextBatch(sid, 3)!;
      store.append(sid, marker(6));
      const again = store.nextBatch(sid, 3)!;
      expect(again.batchId).toBe(first.batchId);
      expect(again.events.map((e) => e.sequence)).toEqual([1, 2, 3]);
    });

    it('moves to the next batch after ack', () => {
      const store = factory();
      for (let i = 1; i <= 5; i++) store.append(sid, marker(i));
      const first = store.nextBatch(sid, 3)!;
      store.ackThrough(sid, 3);
      const second = store.nextBatch(sid, 3)!;
      expect(second.batchId).not.toBe(first.batchId);
      expect(second.events.map((e) => e.sequence)).toEqual([4, 5]);
      expect(store.stats(sid)).toMatchObject({ lastAckedSequence: 3, pendingEvents: 2 });
    });

    it('re-batches after a partial ack inside a sealed batch', () => {
      const store = factory();
      for (let i = 1; i <= 5; i++) store.append(sid, marker(i));
      store.nextBatch(sid, 5);
      store.ackThrough(sid, 2);
      expect(store.nextBatch(sid, 5)!.events.map((e) => e.sequence)).toEqual([3, 4, 5]);
    });

    it('preserves event payloads exactly', () => {
      const store = factory();
      const ev: SessionEvent = {
        sequence: 1,
        type: 'stimulus_presented',
        timestamp_ms: 1050.123456789,
        trial_index: 0,
        block_index: 0,
        stimulus_id: 'S1',
        modality: 'visual',
        is_target: true,
        planned_time_ms: 1050,
        actual_time_ms: 1050.123456789,
        frame_number: 63,
        presentation_status: 'on_time',
      };
      store.append(sid, ev);
      expect(store.nextBatch(sid, 1)!.events[0]).toEqual(ev);
    });

    it('stops handing out batches once failed', () => {
      const store = factory();
      store.append(sid, marker(1));
      store.markFailed(sid, 'rejected');
      expect(store.nextBatch(sid, 10)).toBeNull();
      expect(store.stats(sid).failed).toBe(true);
    });

    it('isolates sessions', () => {
      const store = factory();
      store.append('a', marker(1));
      store.append('b', marker(1));
      store.ackThrough('a', 1);
      expect(store.stats('b').pendingEvents).toBe(1);
    });
  });
}
