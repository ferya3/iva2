import type { QualityFlagDto, ValidityStatus } from '@cognitest/shared-types';

export interface ScoringConfig {
  /** block_key values excluded from scoring (practice). */
  practiceBlockKeys: string[];
  /** Exclude trials whose onset was late (default: keep, but report). */
  excludeLateOnsets: boolean;
  quality: QualityRules;
}

export interface QualityRules {
  lateOnsetRatio: { warn: number; critical: number };
  droppedStimulusRatio: { warn: number; critical: number };
  frameDropEventsPerMinute: { warn: number; critical: number };
  hiddenTimeMs: { warn: number; critical: number };
  focusLossCount: { warn: number; critical: number };
  audioErrors: { warn: number; critical: number };
  /** Overall omission rate above which engagement is questioned. */
  omissionRate: { warn: number; critical: number };
}

export const DEFAULT_QUALITY_RULES: QualityRules = {
  lateOnsetRatio: { warn: 0.02, critical: 0.1 },
  droppedStimulusRatio: { warn: 0.001, critical: 0.05 },
  frameDropEventsPerMinute: { warn: 2, critical: 20 },
  hiddenTimeMs: { warn: 1, critical: 10_000 },
  focusLossCount: { warn: 1, critical: 5 },
  audioErrors: { warn: 1, critical: 3 },
  omissionRate: { warn: 0.5, critical: 0.9 },
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  practiceBlockKeys: ['practice'],
  excludeLateOnsets: false,
  quality: DEFAULT_QUALITY_RULES,
};

export interface Metric {
  key: string;
  value: number | null;
  unit: string | null;
  scope: string;
}

export type QualityFlag = QualityFlagDto;

export interface ScoringResult {
  algorithm_version: string;
  validity_status: ValidityStatus;
  quality_flags: QualityFlag[];
  metrics: Metric[];
  trial_count: number;
}
