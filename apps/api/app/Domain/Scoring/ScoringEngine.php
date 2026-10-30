<?php

namespace App\Domain\Scoring;

interface ScoringEngine
{
    /**
     * @param  list<array<string, mixed>>  $events  wire-format raw events
     * @return array{algorithm_version: string, validity_status: string, quality_flags: list<array>, metrics: list<array>, trial_count: int}
     */
    public function score(array $events, array $config): array;
}
