<?php

namespace App\Domain\Scoring;

use App\Domain\Events\EventStream;
use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Exceptions\ApiException;
use App\Models\ScoringMetric;
use App\Models\ScoringRun;
use App\Models\TestSession;
use App\Models\ValidityResult;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Creates a scoring run: raw events → engine → metrics + validity.
 * Runs are append-only history; re-scoring (e.g. with a new algorithm
 * version) adds a run and never overwrites an earlier one.
 */
final class ScoreSession
{
    public const SCORABLE = [SessionStatus::Completed, SessionStatus::Validated, SessionStatus::Reported, SessionStatus::Invalid];

    public function __construct(
        private readonly ScoringEngine $engine,
        private readonly EventStream $stream,
        private readonly SessionStateMachine $states,
    ) {}

    public function run(TestSession $session, ?string $requestedBy = null): ScoringRun
    {
        if (! in_array($session->status, self::SCORABLE, true)) {
            throw new ApiException('Session has no complete data to score yet.', 'session_not_scorable', 409, ['status' => $session->status->value]);
        }

        $version = $session->assessmentVersion()->with(['protocol', 'validationRules', 'defaultScoringVersion'])->firstOrFail();
        $scoringVersion = $version->defaultScoringVersion;
        $run = ScoringRun::create([
            'session_id' => $session->id,
            'scoring_version_id' => $scoringVersion?->id,
            'status' => 'running',
            'requested_by' => $requestedBy,
            'started_at' => now(),
        ]);

        try {
            $events = $this->stream->forSession($session);
            $config = $this->config($version);
            $run->input_sha256 = hash('sha256', json_encode($events, JSON_PRESERVE_ZERO_FRACTION));
            $result = $this->engine->score($events, $config);
        } catch (Throwable $e) {
            $run->forceFill(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 2000), 'finished_at' => now()])->save();
            throw $e;
        }

        DB::transaction(function () use ($session, $run, $result) {
            $rows = array_map(fn (array $m) => [
                'tenant_id' => $session->tenant_id,
                'scoring_run_id' => $run->id,
                'metric_key' => $m['key'],
                'scope' => $m['scope'],
                'value' => $m['value'],
                'unit' => $m['unit'],
            ], $result['metrics']);
            foreach (array_chunk($rows, 500) as $chunk) {
                ScoringMetric::insert($chunk);
            }
            ValidityResult::create([
                'session_id' => $session->id,
                'scoring_run_id' => $run->id,
                'validity_status' => $result['validity_status'],
                'flags' => $result['quality_flags'],
            ]);
            $run->forceFill([
                'status' => 'succeeded',
                'algorithm_version' => $result['algorithm_version'],
                'finished_at' => now(),
            ])->save();

            $session->refresh();
            if ($session->status === SessionStatus::Completed) {
                $to = $result['validity_status'] === 'invalid' ? SessionStatus::Invalid : SessionStatus::Validated;
                $this->states->transition($session, $to, 'system', null, "scoring {$result['validity_status']}", [
                    'validity_status' => $result['validity_status'],
                ]);
            } else {
                $session->forceFill(['validity_status' => $result['validity_status']])->save();
            }
        });

        return $run->refresh();
    }

    private function config($version): array
    {
        $blocks = $version->protocol?->config['blocks'] ?? [];
        $practice = array_values(array_map(fn ($b) => $b['key'], array_filter($blocks, fn ($b) => $b['practice'] ?? false)));

        return array_filter([
            ...($version->defaultScoringVersion?->config ?? []),
            'practiceBlockKeys' => $practice,
            'quality' => $version->validationRules?->rules['quality'] ?? null,
        ], fn ($v) => $v !== null);
    }
}
