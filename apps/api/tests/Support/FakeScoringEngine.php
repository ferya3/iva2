<?php

namespace Tests\Support;

use App\Domain\Scoring\ScoringEngine;

final class FakeScoringEngine implements ScoringEngine
{
    public array $calls = [];

    public function __construct(private readonly string $validity = 'valid') {}

    public function score(array $events, array $config): array
    {
        $this->calls[] = ['events' => count($events), 'config' => $config];

        return [
            'algorithm_version' => 'fake/1.0.0',
            'validity_status' => $this->validity,
            'quality_flags' => $this->validity === 'valid' ? [] : [['code' => 'run.aborted', 'severity' => 'critical', 'message' => 'aborted']],
            'metrics' => [
                ['key' => 'trials', 'value' => 200, 'unit' => 'count', 'scope' => 'overall'],
                ['key' => 'hit_rate', 'value' => 0.96, 'unit' => 'ratio', 'scope' => 'overall'],
                ['key' => 'rt_mean', 'value' => 412.68, 'unit' => 'ms', 'scope' => 'overall'],
                ['key' => 'rt_mean', 'value' => 405.1, 'unit' => 'ms', 'scope' => 'visual'],
            ],
            'trial_count' => 200,
        ];
    }
}
