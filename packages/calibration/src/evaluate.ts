import type { AudioMeasurement } from './audio';
import type { DisplayMeasurement } from './display';
import type { InputMeasurement } from './input';

export interface CalibrationThresholds {
  minRefreshHz: number;
  maxFrameSdMs: number;
  maxDroppedRatio: number;
  maxInputDispatchP95Ms: number;
  requireAudio: boolean;
  maxAudioOutputLatencyMs: number;
  /** Ratio of a threshold at which a "warn" is raised before "fail". */
  warnAt: number;
}

/**
 * Conservative defaults for the demo protocol. Real protocols ship their own
 * thresholds in assessment_versions.validation_rules, derived from a timing
 * validation study — these numbers are engineering placeholders.
 */
export const DEFAULT_THRESHOLDS: CalibrationThresholds = {
  minRefreshHz: 59,
  maxFrameSdMs: 2.0,
  maxDroppedRatio: 0.01,
  maxInputDispatchP95Ms: 16,
  requireAudio: false,
  maxAudioOutputLatencyMs: 120,
  warnAt: 0.75,
};

export interface CalibrationReason {
  code: string;
  message: string;
}

export interface CalibrationResult {
  display: DisplayMeasurement;
  input: InputMeasurement;
  audio: AudioMeasurement;
  verdict: 'pass' | 'warn' | 'fail';
  reasons: CalibrationReason[];
}

export function evaluateCalibration(
  display: DisplayMeasurement,
  input: InputMeasurement,
  audio: AudioMeasurement,
  thresholds: CalibrationThresholds = DEFAULT_THRESHOLDS,
): CalibrationResult {
  const fails: CalibrationReason[] = [];
  const warns: CalibrationReason[] = [];
  const upper = (code: string, value: number | null, limit: number, label: string) => {
    if (value === null) return;
    if (value > limit) fails.push({ code, message: `${label} ${value} exceeds limit ${limit}` });
    else if (value > limit * thresholds.warnAt)
      warns.push({ code, message: `${label} ${value} is close to limit ${limit}` });
  };

  if (display.refresh_rate_hz < thresholds.minRefreshHz) {
    fails.push({
      code: 'display.refresh_rate',
      message: `refresh rate ${display.refresh_rate_hz} Hz is below ${thresholds.minRefreshHz} Hz`,
    });
  }
  upper('display.jitter', display.frame_interval_sd_ms, thresholds.maxFrameSdMs, 'frame interval SD (ms)');
  upper('display.dropped_frames', display.dropped_frame_ratio, thresholds.maxDroppedRatio, 'dropped frame ratio');
  upper('input.dispatch_latency', input.dispatch_latency_p95_ms, thresholds.maxInputDispatchP95Ms, 'input dispatch p95 (ms)');

  if (thresholds.requireAudio && !audio.available) {
    fails.push({ code: 'audio.unavailable', message: 'audio output is required but unavailable' });
  }
  upper('audio.output_latency', audio.output_latency_ms, thresholds.maxAudioOutputLatencyMs, 'audio output latency (ms)');

  const verdict = fails.length ? 'fail' : warns.length ? 'warn' : 'pass';
  return { display, input, audio, verdict, reasons: [...fails, ...warns] };
}
