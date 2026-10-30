<?php

namespace App\Domain\Scoring;

use Illuminate\Support\Facades\Process;

/**
 * Runs the TypeScript scoring engine (packages/scoring-engine, bundled to a
 * single ESM file) as a subprocess. One implementation of the algorithm
 * serves the server, offline re-analysis and the test-suite.
 */
final class NodeScoringEngine implements ScoringEngine
{
    public function __construct(
        private readonly string $node,
        private readonly string $cli,
        private readonly int $timeout,
    ) {}

    public function score(array $events, array $config): array
    {
        if (! is_file($this->cli)) {
            throw new ScoringFailed("Scoring CLI not found at {$this->cli}; build packages/scoring-engine.");
        }
        $input = json_encode(['events' => $events, 'config' => (object) $config], JSON_PRESERVE_ZERO_FRACTION | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        $result = Process::timeout($this->timeout)->input($input)->run([$this->node, $this->cli]);
        if (! $result->successful()) {
            throw new ScoringFailed('Scoring engine exited with '.$result->exitCode().': '.trim($result->errorOutput()));
        }

        $output = json_decode($result->output(), true);
        if (! is_array($output) || ! isset($output['algorithm_version'], $output['metrics'], $output['validity_status'])) {
            throw new ScoringFailed('Scoring engine returned malformed output.');
        }

        return $output;
    }
}
