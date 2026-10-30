import { describe, expect, it } from 'vitest';
import {
  IntervalTracker,
  ManualClock,
  OffsetClock,
  createRng,
  median,
  quantile,
  shuffle,
  standardDeviation,
  summarize,
} from '../src';

describe('clocks', () => {
  it('re-bases timestamps to the session origin', () => {
    const source = new ManualClock(5_000);
    const clock = new OffsetClock(source);
    source.advance(16.7);
    expect(clock.now()).toBeCloseTo(16.7, 9);
    expect(clock.fromSource(5_100.25)).toBeCloseTo(100.25, 9);
  });

  it('refuses to move a manual clock backwards', () => {
    const clock = new ManualClock(10);
    expect(() => clock.set(9)).toThrow();
  });
});

describe('statistics', () => {
  it('computes R type-7 quantiles', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.95)).toBeCloseTo(48, 9);
    expect(median([3, 1, 2])).toBe(2);
  });

  it('uses the sample standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(Number.isNaN(standardDeviation([1]))).toBe(true);
  });

  it('summarizes without mutating input', () => {
    const values = [5, 1, 3];
    const s = summarize(values);
    expect(values).toEqual([5, 1, 3]);
    expect(s).toMatchObject({ n: 3, min: 1, max: 5, median: 3, mean: 3 });
  });
});

describe('interval tracker', () => {
  it('detects dropped vsyncs at 60 Hz', () => {
    const tracker = new IntervalTracker(1000 / 60);
    let t = 0;
    tracker.push(t);
    for (let i = 0; i < 10; i++) tracker.push((t += 1000 / 60));
    const sample = tracker.push((t += (1000 / 60) * 3)); // two vsyncs missed
    expect(sample?.droppedFrames).toBe(2);
    expect(tracker.droppedFrames).toBe(2);
    expect(tracker.droppedRatio).toBeCloseTo(2 / 13, 9);
  });

  it('tolerates normal jitter', () => {
    const tracker = new IntervalTracker(1000 / 60);
    tracker.push(0);
    expect(tracker.push(18.5)?.droppedFrames).toBe(0);
  });
});

describe('seeded random', () => {
  it('is reproducible for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('shuffles deterministically and keeps all items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = shuffle(items, createRng(7));
    expect(shuffle(items, createRng(7))).toEqual(s1);
    expect([...s1].sort()).toEqual(items);
  });
});
