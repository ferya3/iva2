<?php

namespace App\Domain\Reports;

use App\Models\ScoringRun;
use App\Models\TestSession;
use Illuminate\Support\Str;

/**
 * Builds the report document (schema: packages/report-schema). The
 * document is a frozen snapshot: later re-scoring produces a new report
 * version rather than mutating this one.
 */
final class ReportBuilder
{
    public const SCHEMA_VERSION = '1.0';

    /** Reports are Persian whatever the server's APP_LOCALE is. */
    public const LOCALE = 'fa';

    private const OVERVIEW = ['trials', 'hit_rate', 'omissions', 'commissions', 'rt_mean', 'rt_median', 'rt_sd', 'rt_cv', 'd_prime', 'criterion_c', 'anticipatory_responses'];

    private const MODALITY = ['hit_rate', 'commission_rate', 'rt_mean', 'rt_sd', 'd_prime'];

    public function build(TestSession $session, ScoringRun $run, int $version): array
    {
        $session->loadMissing(['patient.profile', 'assessmentVersion.type', 'deviceProfile', 'latestCalibration', 'tenant']);
        $run->loadMissing(['metrics', 'validity']);
        $metrics = $run->metrics->groupBy('scope');
        $assessment = $session->assessmentVersion;
        $profile = $session->patient->profile;

        $pick = fn (string $scope, array $keys) => collect($keys)
            ->map(fn ($key) => $metrics->get($scope)?->firstWhere('metric_key', $key))
            ->filter()
            ->map(fn ($m) => [
                'key' => $m->metric_key,
                'label' => __("metrics.{$m->metric_key}", [], self::LOCALE),
                'value' => $m->value,
                'unit' => $m->unit,
                'scope' => $m->scope,
            ])->values()->all();

        $sections = [
            ['key' => 'overview', 'title' => __('metrics.sections.overview', [], self::LOCALE), 'metrics' => $pick('overall', self::OVERVIEW)],
            ['key' => 'visual', 'title' => __('metrics.sections.visual', [], self::LOCALE), 'metrics' => $pick('visual', self::MODALITY)],
            ['key' => 'auditory', 'title' => __('metrics.sections.auditory', [], self::LOCALE), 'metrics' => $pick('auditory', self::MODALITY)],
            ['key' => 'trend', 'title' => __('metrics.sections.trend', [], self::LOCALE), 'metrics' => $pick('overall', ['rt_mean_slope_per_block', 'hit_rate_slope_per_block'])],
        ];
        $sections = array_values(array_filter($sections, fn ($s) => $s['metrics'] !== []));

        $disclaimers = __('metrics.disclaimers', [], self::LOCALE);
        if (! $assessment->is_clinical) {
            array_unshift($disclaimers, __('metrics.non_clinical', [], self::LOCALE));
        }

        $calibration = $session->latestCalibration;

        return [
            'schema_version' => self::SCHEMA_VERSION,
            'report_id' => (string) Str::uuid(),
            'report_version' => $version,
            'generated_at' => now()->toIso8601String(),
            'locale' => self::LOCALE,
            'tenant' => ['name' => $session->tenant->name],
            'patient' => [
                'code' => $session->patient->patient_code,
                'age_years' => $profile?->ageYears($session->started_at),
                'sex' => $profile?->sex,
                'handedness' => $profile?->handedness,
            ],
            'session' => [
                'id' => $session->id,
                'assessment_key' => $assessment->type->key,
                'assessment_name' => $assessment->type->name,
                'assessment_version' => $assessment->version,
                'is_clinical' => $assessment->is_clinical,
                'engine_version' => $session->engine_version,
                'started_at' => $session->started_at?->toIso8601String(),
                'completed_at' => $session->completed_at?->toIso8601String(),
                'device' => array_filter([
                    'os' => $session->deviceProfile?->device_info['os'] ?? null,
                    'refresh_rate_hz' => $calibration?->refresh_rate_hz,
                    'calibration_verdict' => $calibration?->verdict,
                ], fn ($v) => $v !== null) ?: null,
            ],
            'quality' => [
                'validity_status' => $run->validity->validity_status,
                'flags' => $run->validity->flags,
            ],
            'scoring' => [
                'algorithm_version' => $run->algorithm_version,
                'scored_at' => $run->finished_at->toIso8601String(),
            ],
            'sections' => $sections,
            'disclaimers' => $disclaimers,
        ];
    }
}
