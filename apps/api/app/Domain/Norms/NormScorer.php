<?php

namespace App\Domain\Norms;

use App\Models\NormEntry;
use App\Models\NormSet;
use App\Models\TestSession;
use Illuminate\Support\Collection;

/**
 * Compares a session's metrics with the published norm set of its
 * assessment version, using the age (at the session) and sex of the
 * patient. Sex-specific bands are preferred over combined ones.
 *
 * Scores assume an approximately normal distribution within each band:
 * z = (value − mean) / SD, oriented so higher = better, standard score
 * = 100 + 15·z, percentile = Φ(z). Skewed metrics (reaction times) should be
 * normed on a transformed scale or with percentile tables in the future.
 */
final class NormScorer
{
    /**
     * Scores are keyed "scope:metric_key"; null when no norm applies (no
     * published set, unknown age, or no band for this age).
     *
     * @param  Collection<int, object{metric_key: string, scope: string, value: ?float}>  $metrics
     * @return array{set: array<string, mixed>, age_years: int, sex: ?string, scores: array<string, array<string, mixed>>}|null
     */
    public function score(TestSession $session, Collection $metrics): ?array
    {
        $session->loadMissing('patient.profile');
        $profile = $session->patient?->profile;
        $age = $profile?->ageYears($session->started_at ?? $session->created_at);
        if ($age === null) {
            return null;
        }
        $set = NormSet::query()->published()->where('assessment_version_id', $session->assessment_version_id)
            ->orderByDesc('published_at')->first();
        if (! $set) {
            return null;
        }
        $sex = in_array($profile->sex, ['male', 'female'], true) ? $profile->sex : null;
        $entries = $set->entries()
            ->where('age_min_years', '<=', $age)->where('age_max_years', '>=', $age)
            ->whereIn('sex', array_filter(['all', $sex]))
            ->get()
            ->sortBy(fn (NormEntry $e) => $e->sex === 'all' ? 1 : 0) // sex-specific first
            ->unique(fn (NormEntry $e) => "{$e->scope}:{$e->metric_key}");

        $scores = [];
        foreach ($entries as $entry) {
            $metric = $metrics->first(fn ($m) => $m->metric_key === $entry->metric_key && $m->scope === $entry->scope);
            if ($metric === null || $metric->value === null) {
                continue;
            }
            $scores["{$entry->scope}:{$entry->metric_key}"] = ['scope' => $entry->scope, 'key' => $entry->metric_key, ...self::compare((float) $metric->value, $entry)];
        }
        if ($scores === []) {
            return null;
        }

        return [
            'set' => [
                'id' => $set->id,
                'name' => $set->name,
                'version' => $set->version,
                'provisional' => $set->provisional,
                'source' => $set->source,
            ],
            'age_years' => $age,
            'sex' => $sex,
            'scores' => $scores,
        ];
    }

    /** @return array{z: float, standard_score: int, percentile: float, band: string, direction: string, n: int, age_band: string, sex: string} */
    public static function compare(float $value, NormEntry $entry): array
    {
        $direction = MetricDirection::from($entry->direction);
        $z = ($value - $entry->mean) / $entry->sd;
        $oriented = $direction === MetricDirection::LowerBetter ? -$z : $z;
        $standard = (int) round(100 + 15 * $oriented);

        return [
            'z' => round($oriented, 2),
            'standard_score' => $standard,
            'percentile' => round(min(99.9, max(0.1, self::normalCdf($oriented) * 100)), 1),
            'band' => self::band($standard),
            'direction' => $direction->value,
            'n' => $entry->n,
            'age_band' => "{$entry->age_min_years}–{$entry->age_max_years}",
            'sex' => $entry->sex,
        ];
    }

    /** very_low < 70 ≤ low < 85 ≤ average < 115 ≤ high < 130 ≤ very_high */
    public static function band(int $standardScore): string
    {
        return match (true) {
            $standardScore < 70 => 'very_low',
            $standardScore < 85 => 'low',
            $standardScore < 115 => 'average',
            $standardScore < 130 => 'high',
            default => 'very_high',
        };
    }

    /** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
    public static function normalCdf(float $z): float
    {
        $x = abs($z) / M_SQRT2;
        $t = 1 / (1 + 0.3275911 * $x);
        $erf = 1 - ((((1.061405429 * $t - 1.453152027) * $t + 1.421413741) * $t - 0.284496736) * $t + 0.254829592) * $t * exp(-$x * $x);

        return $z >= 0 ? (1 + $erf) / 2 : (1 - $erf) / 2;
    }
}
