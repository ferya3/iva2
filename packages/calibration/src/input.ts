import { mean, quantile, round } from '@cognitest/timing-core';

export interface InputSample {
  /** Event.timeStamp — when the OS/browser stamped the input. */
  eventTime: number;
  /** performance.now() when the handler ran. */
  handlerTime: number;
}

export interface InputMeasurement {
  samples: number;
  dispatch_latency_mean_ms: number | null;
  dispatch_latency_p95_ms: number | null;
}

/**
 * Dispatch latency is the delay between input timestamping and handler
 * execution. It measures main-thread congestion, NOT end-to-end device
 * latency (keyboard scan rate / USB polling), which needs external hardware.
 */
export function analyzeInputLatency(samples: readonly InputSample[]): InputMeasurement {
  const lat = samples.map((s) => Math.max(0, s.handlerTime - s.eventTime));
  return {
    samples: lat.length,
    dispatch_latency_mean_ms: lat.length ? round(mean(lat), 3) : null,
    dispatch_latency_p95_ms: lat.length ? round(quantile(lat, 0.95), 3) : null,
  };
}
