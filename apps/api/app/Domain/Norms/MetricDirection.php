<?php

namespace App\Domain\Norms;

/**
 * Which way is "better" for a metric. Standard scores are oriented so that
 * higher always means better performance (100 = age average, SD 15); for
 * neutral metrics (e.g. response criterion) they describe the value only.
 */
enum MetricDirection: string
{
    case HigherBetter = 'higher_better';
    case LowerBetter = 'lower_better';
    case Neutral = 'neutral';

    private const DEFAULTS = [
        'hits' => self::HigherBetter,
        'hit_rate' => self::HigherBetter,
        'correct_rejections' => self::HigherBetter,
        'd_prime' => self::HigherBetter,
        'omissions' => self::LowerBetter,
        'omission_rate' => self::LowerBetter,
        'commissions' => self::LowerBetter,
        'commission_rate' => self::LowerBetter,
        'anticipatory_responses' => self::LowerBetter,
        'repeated_responses' => self::LowerBetter,
        'rt_mean' => self::LowerBetter,
        'rt_median' => self::LowerBetter,
        'rt_sd' => self::LowerBetter,
        'rt_cv' => self::LowerBetter,
    ];

    public static function defaultFor(string $metricKey): self
    {
        return self::DEFAULTS[$metricKey] ?? self::Neutral;
    }
}
