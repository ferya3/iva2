<?php

namespace Tests\Unit;

use App\Domain\Sessions\SessionStatus;
use PHPUnit\Framework\TestCase;

/**
 * The session state machine exists in TypeScript (player, panels) and PHP
 * (API). This test parses the TypeScript source and fails on any drift.
 */
class SessionStatusParityTest extends TestCase
{
    public function test_transition_matrix_matches_shared_types(): void
    {
        $ts = file_get_contents(__DIR__.'/../../../../packages/shared-types/src/session-status.ts');
        preg_match('/SESSION_TRANSITIONS[^{]*\{(.*?)\n\};/s', $ts, $block);
        preg_match_all("/^\s*([A-Z_]+): \[(.*?)\],/m", $block[1], $rows, PREG_SET_ORDER);

        $fromTs = [];
        foreach ($rows as [, $from, $targets]) {
            preg_match_all("/'([A-Z_]+)'/", $targets, $t);
            $fromTs[$from] = $t[1];
        }

        $fromPhp = [];
        foreach (SessionStatus::cases() as $status) {
            $fromPhp[$status->value] = array_map(fn ($s) => $s->value, $status->allowedTransitions());
        }

        $this->assertNotEmpty($fromTs);
        $this->assertEquals($fromTs, $fromPhp);
    }
}
