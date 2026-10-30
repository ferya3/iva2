import { describe, expect, it } from 'vitest';
import {
  analyzeFrameTimestamps,
  analyzeInputLatency,
  describeAudioContext,
  evaluateCalibration,
  measureDisplay,
  nominalRefreshRate,
} from '../src';

const frames = (hz: number, n: number, jitter = 0, dropEvery = 0) => {
  const out: number[] = [];
  let t = 1000;
  for (let i = 0; i < n; i++) {
    out.push(t + (i % 2 ? jitter : -jitter));
    t += 1000 / hz;
    if (dropEvery && i > 0 && i % dropEvery === 0) t += 1000 / hz;
  }
  return out;
};

describe('display analysis', () => {
  it('measures a clean 60 Hz display', () => {
    const d = analyzeFrameTimestamps(frames(60, 240));
    expect(d.refresh_rate_hz).toBeCloseTo(60, 1);
    expect(d.dropped_frame_ratio).toBe(0);
    expect(nominalRefreshRate(d.refresh_rate_hz)).toBe(60);
  });

  it('measures 144 Hz', () => {
    expect(analyzeFrameTimestamps(frames(144, 300)).refresh_rate_hz).toBeCloseTo(144, 0);
  });

  it('counts dropped frames without biasing the refresh estimate', () => {
    const d = analyzeFrameTimestamps(frames(60, 300, 0, 50));
    expect(d.refresh_rate_hz).toBeCloseTo(60, 1);
    expect(d.dropped_frame_ratio).toBeGreaterThan(0);
  });

  it('samples via a requestAnimationFrame-like function', async () => {
    let t = 0;
    const raf = (cb: (t: number) => void) => queueMicrotask(() => cb((t += 1000 / 60)));
    const d = await measureDisplay(raf, 500);
    expect(d.samples).toBeGreaterThanOrEqual(29);
  });
});

describe('calibration verdict', () => {
  const input = analyzeInputLatency([{ eventTime: 0, handlerTime: 2 }]);
  const audio = describeAudioContext(null);

  it('passes a healthy machine', () => {
    const r = evaluateCalibration(analyzeFrameTimestamps(frames(60, 240)), input, audio);
    expect(r.verdict).toBe('pass');
  });

  it('fails a 30 Hz display', () => {
    const r = evaluateCalibration(analyzeFrameTimestamps(frames(30, 120)), input, audio);
    expect(r.verdict).toBe('fail');
    expect(r.reasons[0]?.code).toBe('display.refresh_rate');
  });

  it('warns when jitter approaches the limit', () => {
    const display = { ...analyzeFrameTimestamps(frames(60, 240)), frame_interval_sd_ms: 1.7 };
    const r = evaluateCalibration(display, input, audio);
    expect(r.verdict).toBe('warn');
    expect(r.reasons.map((x) => x.code)).toEqual(['display.jitter']);
  });

  it('reports audio latencies in milliseconds', () => {
    expect(describeAudioContext({ sampleRate: 48000, baseLatency: 0.01, outputLatency: 0.04 })).toEqual({
      available: true,
      sample_rate: 48000,
      base_latency_ms: 10,
      output_latency_ms: 40,
    });
  });
});
