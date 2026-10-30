<?php

namespace App\Domain\Sessions;

use App\Models\SessionState;
use App\Models\TestSession;
use Illuminate\Support\Facades\DB;

/**
 * The only writer of test_sessions.status. Every change is validated
 * against the transition matrix and recorded in session_states.
 */
final class SessionStateMachine
{
    public function transition(
        TestSession $session,
        SessionStatus $to,
        string $actorType,
        ?string $actorId = null,
        ?string $reason = null,
        array $attributes = [],
    ): TestSession {
        return DB::transaction(function () use ($session, $to, $actorType, $actorId, $reason, $attributes) {
            /** @var TestSession $locked */
            $locked = TestSession::query()->lockForUpdate()->findOrFail($session->getKey());
            $from = $locked->status;
            if (! $from->canTransitionTo($to)) {
                throw InvalidSessionTransition::between($from, $to);
            }
            $locked->forceFill(['status' => $to, ...$attributes])->save();
            SessionState::create([
                'tenant_id' => $locked->tenant_id,
                'session_id' => $locked->id,
                'from_status' => $from->value,
                'to_status' => $to->value,
                'actor_type' => $actorType,
                'actor_id' => $actorId,
                'reason' => $reason,
            ]);
            $session->setRawAttributes($locked->getAttributes(), true);

            return $session;
        });
    }

    /** Walks several steps atomically (e.g. RUNNING → UPLOADING → COMPLETED). */
    public function path(TestSession $session, array $steps, string $actorType, ?string $actorId = null, array $attributes = []): TestSession
    {
        return DB::transaction(function () use ($session, $steps, $actorType, $actorId, $attributes) {
            foreach ($steps as $i => $step) {
                $this->transition($session, $step, $actorType, $actorId, null, $i === array_key_last($steps) ? $attributes : []);
            }

            return $session;
        });
    }
}
