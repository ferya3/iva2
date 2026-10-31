<?php

namespace App\Domain\Norms;

use App\Domain\Scoring\MetricKeys;
use App\Domain\Sessions\SessionStatus;
use App\Models\AssessmentVersion;
use App\Models\TestSession;
use Generator;

/**
 * Anonymised results for norm studies: valid, scored sessions of one
 * assessment version whose patient (or guardian) consented to research use.
 * Rows carry no identity data — only a random participant pseudonym (to
 * recognise repeat tests), age in months, sex, handedness, education, the
 * test month and the metrics. Runs in system context (all clinics).
 */
final class ResearchDataset
{
    public const SCOPES = ['overall', 'visual', 'auditory'];

    /** @return list<string> metric keys exported per scope */
    public static function metricKeys(): array
    {
        return MetricKeys::ALL;
    }

    /** @return list<string> */
    public static function header(): array
    {
        $metrics = [];
        foreach (self::SCOPES as $scope) {
            foreach (self::metricKeys() as $key) {
                $metrics[] = "{$scope}.{$key}";
            }
        }

        return ['participant', 'attempt', 'age_years', 'age_months', 'sex', 'handedness', 'education', 'assessment_version', 'tested_month', ...$metrics];
    }

    /** @return Generator<int, list<scalar|null>> */
    public function rows(AssessmentVersion $version): Generator
    {
        $attempts = [];
        foreach ($this->sessions($version)->lazyById(200) as $session) {
            $run = $session->latestSucceededRun;
            if ($run?->validity?->validity_status !== 'valid') {
                continue;
            }
            $profile = $session->patient->profile;
            $at = $session->started_at ?? $session->created_at;
            $participant = $session->patient->pseudonym;
            $attempts[$participant] = ($attempts[$participant] ?? 0) + 1;
            $values = [];
            foreach ($run->metrics as $m) {
                $values["{$m->scope}.{$m->metric_key}"] = $m->value;
            }
            $metrics = [];
            foreach (self::SCOPES as $scope) {
                foreach (self::metricKeys() as $key) {
                    $metrics[] = $values["{$scope}.{$key}"] ?? null;
                }
            }

            yield [
                $participant,
                $attempts[$participant],
                $profile->ageYears($at),
                (int) floor(abs($profile->birth_date->diffInMonths($at))),
                $profile->sex,
                $profile->handedness,
                $profile->education,
                $version->version,
                $at->format('Y-m'),
                ...$metrics,
            ];
        }
    }

    /**
     * Eligible sample by age and sex (first attempts only), to see whether
     * each age band has enough participants before norming.
     *
     * @return array{total_sessions: int, eligible_sessions: int, participants: int, by_age: list<array{age_years: int, male: int, female: int, other: int, total: int}>}
     */
    public function summary(AssessmentVersion $version): array
    {
        $byAge = [];
        $eligible = 0;
        foreach ($this->rows($version) as $row) {
            $eligible++;
            if ($row[1] !== 1) {
                continue;
            }
            $age = $row[2];
            $sex = in_array($row[4], ['male', 'female'], true) ? $row[4] : 'other';
            $byAge[$age] ??= ['age_years' => $age, 'male' => 0, 'female' => 0, 'other' => 0, 'total' => 0];
            $byAge[$age][$sex]++;
            $byAge[$age]['total']++;
        }
        ksort($byAge);

        return [
            'total_sessions' => TestSession::query()->where('assessment_version_id', $version->id)
                ->whereIn('status', [SessionStatus::Validated->value, SessionStatus::Reported->value])->count(),
            'eligible_sessions' => $eligible,
            'participants' => array_sum(array_column($byAge, 'total')),
            'by_age' => array_values($byAge),
        ];
    }

    private function sessions(AssessmentVersion $version)
    {
        return TestSession::query()
            ->where('assessment_version_id', $version->id)
            ->whereIn('status', [SessionStatus::Validated->value, SessionStatus::Reported->value])
            ->whereHas('patient.researchConsent')
            ->whereHas('patient.profile', fn ($q) => $q->whereNotNull('birth_date'))
            ->with(['patient.profile', 'latestSucceededRun.metrics', 'latestSucceededRun.validity']);
    }
}
