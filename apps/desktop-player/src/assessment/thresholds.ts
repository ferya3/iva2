import { DEFAULT_THRESHOLDS, type CalibrationThresholds } from '@cognitest/calibration';

const MAP: Record<string, keyof CalibrationThresholds> = {
  min_refresh_hz: 'minRefreshHz',
  max_frame_sd_ms: 'maxFrameSdMs',
  max_dropped_ratio: 'maxDroppedRatio',
  max_input_dispatch_p95_ms: 'maxInputDispatchP95Ms',
  require_audio: 'requireAudio',
  max_audio_output_latency_ms: 'maxAudioOutputLatencyMs',
};

/** Server validation rules (snake_case) → calibration package thresholds. */
export function toThresholds(rules: Record<string, number | boolean> | null): CalibrationThresholds {
  const out: Record<string, unknown> = { ...DEFAULT_THRESHOLDS };
  for (const [key, value] of Object.entries(rules ?? {})) {
    const target = MAP[key];
    if (target) out[target] = value;
  }
  return out as unknown as CalibrationThresholds;
}
