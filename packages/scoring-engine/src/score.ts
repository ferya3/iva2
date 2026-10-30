import type { SessionEvent, ValidityStatus } from '@cognitest/shared-types';
import { buildTrials } from './trials';
import { scopeMetrics, trendMetrics } from './metrics';
import { assessQuality } from './quality';
import { DEFAULT_SCORING_CONFIG, type ScoringConfig, type ScoringResult } from './types';

/**
 * Identifier persisted with every scoring run. Bump the version whenever
 * any output can change for the same input — results are only comparable
 * within one algorithm version.
 */
export const ALGORITHM_VERSION = 'generic-cpt/1.0.0';

export function scoreSession(
  events: readonly SessionEvent[],
  config: Partial<ScoringConfig> = {},
): ScoringResult {
  const cfg: ScoringConfig = {
    ...DEFAULT_SCORING_CONFIG,
    ...config,
    quality: { ...DEFAULT_SCORING_CONFIG.quality, ...config.quality },
  };
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  const all = buildTrials(sorted, cfg.practiceBlockKeys, cfg.excludeLateOnsets);
  const scored = all.filter((t) => !t.practice);

  const metrics = [
    ...scopeMetrics(scored, 'overall'),
    ...scopeMetrics(
      scored.filter((t) => t.stimulus.modality === 'visual'),
      'visual',
    ),
    ...scopeMetrics(
      scored.filter((t) => t.stimulus.modality === 'auditory'),
      'auditory',
    ),
    ...[...new Set(scored.map((t) => t.blockKey))].flatMap((key) =>
      scopeMetrics(
        scored.filter((t) => t.blockKey === key),
        `block:${key}`,
      ),
    ),
    ...trendMetrics(scored),
  ];

  const quality_flags = assessQuality(sorted, all, cfg.quality);
  const validity_status: ValidityStatus = quality_flags.some((f) => f.severity === 'critical')
    ? 'invalid'
    : quality_flags.some((f) => f.severity === 'warning')
      ? 'questionable'
      : 'valid';

  return { algorithm_version: ALGORITHM_VERSION, validity_status, quality_flags, metrics, trial_count: scored.length };
}
