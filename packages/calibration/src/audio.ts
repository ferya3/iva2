import { round } from '@cognitest/timing-core';

export interface AudioMeasurement {
  available: boolean;
  sample_rate: number | null;
  base_latency_ms: number | null;
  output_latency_ms: number | null;
}

type AudioContextLike = Pick<AudioContext, 'sampleRate' | 'baseLatency'> & {
  outputLatency?: number;
};

/** Reads the latencies the audio stack reports. Loopback tests remain required. */
export function describeAudioContext(ctx: AudioContextLike | null): AudioMeasurement {
  if (!ctx)
    return { available: false, sample_rate: null, base_latency_ms: null, output_latency_ms: null };
  return {
    available: true,
    sample_rate: ctx.sampleRate,
    base_latency_ms: Number.isFinite(ctx.baseLatency) ? round(ctx.baseLatency * 1000, 3) : null,
    output_latency_ms:
      typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0
        ? round(ctx.outputLatency * 1000, 3)
        : null,
  };
}
