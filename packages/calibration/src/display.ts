import {
  IntervalTracker,
  intervals,
  median,
  quantile,
  round,
  standardDeviation,
  mean,
} from '@cognitest/timing-core';

export interface DisplayMeasurement {
  samples: number;
  refresh_rate_hz: number;
  frame_interval_mean_ms: number;
  frame_interval_sd_ms: number;
  frame_interval_p99_ms: number;
  dropped_frame_ratio: number;
}

/** Common panel refresh rates; the measured median snaps to the nearest. */
export const NOMINAL_REFRESH_RATES = [50, 59.94, 60, 75, 90, 100, 120, 144, 165, 240] as const;

export function nominalRefreshRate(measuredHz: number, tolerance = 0.03): number | null {
  let best: number | null = null;
  for (const rate of NOMINAL_REFRESH_RATES) {
    const err = Math.abs(measuredHz - rate) / rate;
    if (err <= tolerance && (best === null || err < Math.abs(measuredHz - best) / best))
      best = rate;
  }
  return best;
}

/**
 * Derives display timing from consecutive requestAnimationFrame timestamps.
 * The median interval is used for the refresh estimate so that a few
 * dropped frames do not bias it; drops are then counted against it.
 */
export function analyzeFrameTimestamps(timestamps: readonly number[]): DisplayMeasurement {
  if (timestamps.length < 10) throw new RangeError('need at least 10 frame timestamps');
  const deltas = intervals(timestamps);
  const nominal = median(deltas);
  const tracker = new IntervalTracker(nominal);
  for (const t of timestamps) tracker.push(t);
  return {
    samples: deltas.length,
    refresh_rate_hz: round(1000 / nominal, 2),
    frame_interval_mean_ms: round(mean(deltas), 4),
    frame_interval_sd_ms: round(standardDeviation(deltas), 4),
    frame_interval_p99_ms: round(quantile(deltas, 0.99), 4),
    dropped_frame_ratio: round(tracker.droppedRatio, 5),
  };
}

export type RequestFrame = (callback: (timestamp: number) => void) => unknown;

/** Samples rAF for `durationMs` and analyses the result. */
export function measureDisplay(
  requestFrame: RequestFrame,
  durationMs = 2_000,
): Promise<DisplayMeasurement> {
  return new Promise((resolve, reject) => {
    const stamps: number[] = [];
    const tick = (t: number) => {
      stamps.push(t);
      if (t - stamps[0]! < durationMs) {
        requestFrame(tick);
        return;
      }
      try {
        resolve(analyzeFrameTimestamps(stamps));
      } catch (error) {
        reject(error);
      }
    };
    requestFrame(tick);
  });
}
