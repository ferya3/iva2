import { describe, expect, it } from 'vitest';
import { eventBatchSchema } from '@cognitest/validation';
import { DEMO_CPT_PROTOCOL } from '../src';
import { SMALL_PROTOCOL, createHarness, ofType, runToEnd, withModalities } from './helpers';

describe('event stream integrity', () => {
  it('is gap-free, ordered and framed by session/block events', async () => {
    const h = createHarness(withModalities(['visual', 'auditory'], 30));
    await runToEnd(h, (s) => (s.is_target ? 350 : null));
    const ev = h.sink.events;
    ev.forEach((e, i) => expect(e.sequence).toBe(i + 1));
    for (let i = 1; i < ev.length; i++)
      expect(ev[i]!.timestamp_ms).toBeGreaterThanOrEqual(ev[i - 1]!.timestamp_ms);
    expect(ev[0]!.type).toBe('session_started');
    expect(ev[1]!.type).toBe('block_started');
    expect(ev.at(-2)!.type).toBe('block_ended');
    expect(ev.at(-1)).toMatchObject({ type: 'session_ended', reason: 'completed' });
    expect(h.recorder.isSealed).toBe(true);
  });

  it('produces events that satisfy the wire contract', async () => {
    const h = createHarness(withModalities(['visual', 'auditory'], 30));
    await runToEnd(h, (s) => (s.is_target ? [350, 500] : 80));
    const events = h.sink.events;
    for (let i = 0; i < events.length; i += 200) {
      const result = eventBatchSchema.safeParse({
        session_id: '0b5c1b9e-6c1e-4b7a-9b52-6a3e1f2d9c11',
        batch_id: '6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b',
        engine_version: '1.0.0',
        events: events.slice(i, i + 200),
      });
      expect(result.error?.issues ?? []).toEqual([]);
    }
  });

  it('records the seed and protocol identity needed for replay', async () => {
    const h = createHarness(SMALL_PROTOCOL, { seed: 777 });
    await runToEnd(h);
    expect(h.sink.events[0]).toMatchObject({
      type: 'session_started',
      seed: 777,
      protocol_key: 'test',
      protocol_version: '0.0.1',
      wall_clock_iso: '2026-10-30T08:00:00.000Z',
    });
  });

  it('runs the full demo protocol', async () => {
    let blocksShown = 0;
    const h = createHarness(DEMO_CPT_PROTOCOL, {
      hooks: {
        beforeBlock: async () => {
          blocksShown++;
        },
      },
    });
    const summary = await runToEnd(h, (s) => (s.is_target ? 420 : null));
    expect(summary.state).toBe('completed');
    expect(blocksShown).toBe(5);
    expect(summary.trialsPresented).toBe(16 + 4 * 50);
    expect(ofType(h.sink.events, 'block_started')).toHaveLength(5);
  });
});
