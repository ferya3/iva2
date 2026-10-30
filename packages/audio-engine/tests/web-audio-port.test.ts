import { describe, expect, it } from 'vitest';
import { ManualClock, OffsetClock } from '@cognitest/timing-core';
import { WebAudioPort, synthesizeTone } from '../src';

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  connect() {}
  start(when: number) {
    this.startedAt = when;
  }
  stop() {}
}

function fakeContext(opts: {
  currentTime: number;
  outputLatency: number;
  pair: { contextTime: number; performanceTime: number };
}) {
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: opts.currentTime,
    sampleRate: 48000,
    baseLatency: 0.005,
    outputLatency: opts.outputLatency,
    state: 'running',
    destination: {},
    resume: async () => {},
    close: async () => {},
    createBuffer: (_c: number, length: number) => ({ length, copyToChannel: () => {} }),
    createBufferSource: () => {
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
    getOutputTimestamp: () => opts.pair,
  };
  return { ctx: ctx as never, sources };
}

describe('synthesizeTone', () => {
  it('produces the right length, level and silent edges', () => {
    const s = synthesizeTone({ frequencyHz: 1000, durationMs: 100, levelDb: -6 }, 48000);
    expect(s.length).toBe(4800);
    expect(Math.abs(s[0]!)).toBe(0);
    expect(Math.abs(s.at(-1)!)).toBeLessThan(1e-6);
    expect(Math.max(...s)).toBeCloseTo(10 ** (-6 / 20), 2);
  });

  it('rejects levels above full scale', () => {
    expect(() =>
      synthesizeTone({ frequencyHz: 1000, durationMs: 10, levelDb: 3 }, 48000),
    ).toThrow();
  });
});

describe('WebAudioPort scheduling', () => {
  it('compensates output latency so the acoustic onset hits the planned time', async () => {
    // performance time 10_000 ms ↔ context time 2.0 s; session origin 9_000 ms.
    const clock = new OffsetClock(new ManualClock(10_000), 9_000);
    const { ctx, sources } = fakeContext({
      currentTime: 2,
      outputLatency: 0.02,
      pair: { contextTime: 2, performanceTime: 10_000 },
    });
    const port = new WebAudioPort({ context: ctx, clock });
    await port.prepare({
      tone: { modality: 'auditory', frequencyHz: 500, durationMs: 50, levelDb: -10 },
    });

    const planned = 1_100; // session ms → performance 10_100 → context 2.1 s
    const actual = port.schedule('tone', planned);
    expect(sources[0]!.startedAt).toBeCloseTo(2.1 - 0.02, 9);
    expect(actual).toBeCloseTo(planned, 6);
  });

  it('reports a late onset when the planned time has passed', async () => {
    const clock = new OffsetClock(new ManualClock(10_000), 9_000);
    const { ctx } = fakeContext({
      currentTime: 2.5,
      outputLatency: 0,
      pair: { contextTime: 2, performanceTime: 10_000 },
    });
    const port = new WebAudioPort({ context: ctx, clock });
    await port.prepare({
      tone: { modality: 'auditory', frequencyHz: 500, durationMs: 50, levelDb: -10 },
    });
    expect(port.schedule('tone', 1_100)).toBeGreaterThan(1_100);
  });
});

describe('recorded stimuli', () => {
  it('loads and attenuates bundled recordings', async () => {
    const clock = new OffsetClock(new ManualClock(10_000), 9_000);
    const { ctx } = fakeContext({
      currentTime: 2,
      outputLatency: 0,
      pair: { contextTime: 2, performanceTime: 10_000 },
    });
    const samples = new Float32Array([1, -1, 0.5]);
    const decoded = {
      numberOfChannels: 1,
      getChannelData: () => samples,
    } as unknown as AudioBuffer;
    const port = new WebAudioPort({
      context: ctx,
      clock,
      loadAsset: async () => new ArrayBuffer(8),
      decode: async () => decoded,
    });
    await port.prepare({
      word: { modality: 'auditory', assetKey: 'fa/digit-1', durationMs: 400, levelDb: -6 },
    });
    expect(samples[0]).toBeCloseTo(10 ** (-6 / 20), 6);
    expect(port.schedule('word', 1_100)).toBeCloseTo(1_100, 6);
  });

  it('requires a loader for asset stimuli', async () => {
    const clock = new OffsetClock(new ManualClock(0), 0);
    const { ctx } = fakeContext({
      currentTime: 0,
      outputLatency: 0,
      pair: { contextTime: 0, performanceTime: 0 },
    });
    const port = new WebAudioPort({ context: ctx, clock });
    await expect(
      port.prepare({ w: { modality: 'auditory', assetKey: 'x', durationMs: 100, levelDb: 0 } }),
    ).rejects.toThrow(/loadAsset/);
  });
});
