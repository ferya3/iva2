<?php

namespace App\Domain\Scoring;

/**
 * Metric keys produced by the scoring engine (packages/scoring-engine);
 * labels live in lang/fa/metrics.php and packages/report-schema.
 */
final class MetricKeys
{
    public const ALL = [
        'trials', 'excluded_trials', 'targets', 'non_targets', 'hits', 'omissions', 'commissions',
        'correct_rejections', 'hit_rate', 'omission_rate', 'commission_rate', 'anticipatory_responses',
        'repeated_responses', 'rt_mean', 'rt_median', 'rt_sd', 'rt_cv', 'd_prime', 'criterion_c',
        'rt_mean_slope_per_block', 'hit_rate_slope_per_block',
    ];
}
