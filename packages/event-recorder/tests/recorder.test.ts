import { describe, expect, it } from 'vitest';
import { ManualClock } from '@cognitest/timing-core';
import { EventRecorder, MemoryOutboxStore, MemorySink, OutboxSink } from '../src';
import { outboxContractTests } from '../src/testing';

let ids = 0;
outboxContractTests('MemoryOutboxStore', () => new MemoryOutboxStore(() => `batch-${++ids}`));

describe('EventRecorder', () => {
  it('assigns contiguous sequences and log times', () => {
    const clock = new ManualClock(0);
    const sink = new MemorySink();
    const recorder = new EventRecorder({ clock, sinks: [sink] });
    recorder.record({ type: 'marker', label: 'a' });
    clock.advance(5.5);
    recorder.record({ type: 'focus_lost' });
    expect(sink.events.map((e) => [e.sequence, e.timestamp_ms])).toEqual([
      [1, 0],
      [2, 5.5],
    ]);
  });

  it('produces immutable events', () => {
    const sink = new MemorySink();
    const recorder = new EventRecorder({ clock: new ManualClock(), sinks: [sink] });
    const ev = recorder.record({ type: 'marker', label: 'a' });
    expect(() => {
      (ev as { sequence: number }).sequence = 99;
    }).toThrow();
  });

  it('refuses writes after sealing', () => {
    const recorder = new EventRecorder({ clock: new ManualClock(), sinks: [] });
    recorder.seal();
    expect(() => recorder.record({ type: 'marker', label: 'late' })).toThrow(/sealed/);
  });

  it('can resume numbering after a crash', () => {
    const store = new MemoryOutboxStore();
    for (let i = 1; i <= 3; i++)
      store.append('s', { sequence: i, type: 'marker', timestamp_ms: i, label: 'x' });
    const recorder = new EventRecorder({
      clock: new ManualClock(10),
      sinks: [new OutboxSink(store, 's')],
      firstSequence: store.stats('s').lastRecordedSequence + 1,
    });
    expect(recorder.record({ type: 'focus_gained' }).sequence).toBe(4);
  });
});
