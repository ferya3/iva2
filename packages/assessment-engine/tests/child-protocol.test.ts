import { describe, expect, it } from 'vitest';
import {
  DEMO_CPT_CHILD_PROTOCOL,
  DEMO_CPT_PROTOCOL,
  assertValidProtocol,
  blockDurationMs,
  buildTimeline,
} from '../src';

describe('child version of the demo CPT', () => {
  it('is a valid protocol with the same task and stimuli', () => {
    expect(() => assertValidProtocol(DEMO_CPT_CHILD_PROTOCOL)).not.toThrow();
    expect(DEMO_CPT_CHILD_PROTOCOL.key).toBe(DEMO_CPT_PROTOCOL.key);
    expect(Object.keys(DEMO_CPT_CHILD_PROTOCOL.stimuli)).toEqual(
      Object.keys(DEMO_CPT_PROTOCOL.stimuli),
    );
    expect(DEMO_CPT_CHILD_PROTOCOL.blocks.map((b) => b.targetRatio)).toEqual(
      DEMO_CPT_PROTOCOL.blocks.map((b) => b.targetRatio),
    );
  });

  it('is easier to follow: more practice, more time to answer, fewer trials', () => {
    const child = DEMO_CPT_CHILD_PROTOCOL;
    const std = DEMO_CPT_PROTOCOL;
    expect(child.blocks[0]!.practice).toBe(true);
    expect(child.blocks[0]!.trials).toBeGreaterThan(std.blocks[0]!.trials);
    expect(child.timing.responseWindowMs).toBeGreaterThan(std.timing.responseWindowMs);
    expect(child.timing.visualDurationMs).toBeGreaterThan(std.timing.visualDurationMs);
    const total = (p: typeof child) => p.blocks.reduce((n, b) => n + b.trials, 0);
    expect(total(child)).toBeLessThan(total(std));
    // The response window always closes before the next stimulus.
    const [minSoa] = child.timing.soaMs as [number, number];
    expect(child.timing.responseWindowMs).toBeLessThan(minSoa);
  });

  it('runs in about five and a half minutes', () => {
    const timeline = buildTimeline(DEMO_CPT_CHILD_PROTOCOL, 42);
    expect(timeline.map((b) => b.length)).toEqual([20, 30, 30, 30, 30]);
    const ms =
      timeline.reduce((sum, trials) => sum + blockDurationMs(DEMO_CPT_CHILD_PROTOCOL, trials), 0) +
      (timeline.length - 1) * DEMO_CPT_CHILD_PROTOCOL.timing.interBlockMs;
    expect(ms / 60000).toBeGreaterThan(4.5);
    expect(ms / 60000).toBeLessThan(6.5);
  });
});
