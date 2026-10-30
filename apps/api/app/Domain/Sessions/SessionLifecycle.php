<?php

namespace App\Domain\Sessions;

use App\Exceptions\ApiException;
use App\Jobs\ScoreSessionJob;
use App\Models\CalibrationResult;
use App\Models\DeviceProfile;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Player-facing workflow of a session, from device check to upload.
 * All status changes go through SessionStateMachine.
 */
final class SessionLifecycle
{
    public function __construct(
        private readonly SessionStateMachine $states,
        private readonly CalibrationPolicy $calibration,
        private readonly PlayerAuth $auth,
    ) {}

    public function recordDeviceCheck(TestSession $session, array $device): void
    {
        DB::transaction(function () use ($session, $device) {
            match ($session->status) {
                SessionStatus::Invited, SessionStatus::Calibration => $this->states->transition($session, SessionStatus::DeviceCheck, 'player', $session->id),
                SessionStatus::DeviceCheck => null,
                default => throw InvalidSessionTransition::between($session->status, SessionStatus::DeviceCheck),
            };
            DeviceProfile::create(['session_id' => $session->id, 'device_info' => $device]);
        });
    }

    /** @return array{verdict: string, reasons: array, status: string} */
    public function recordCalibration(TestSession $session, array $result): array
    {
        $rules = $session->assessmentVersion->validationRules?->rules['calibration'] ?? [];
        $evaluation = $this->calibration->evaluate($result, $rules);

        DB::transaction(function () use ($session, $result, $evaluation) {
            if ($session->status === SessionStatus::DeviceCheck) {
                $this->states->transition($session, SessionStatus::Calibration, 'player', $session->id);
            } elseif ($session->status !== SessionStatus::Calibration) {
                throw InvalidSessionTransition::between($session->status, SessionStatus::Calibration);
            }
            CalibrationResult::create([
                'session_id' => $session->id,
                'verdict' => $evaluation['verdict'],
                'refresh_rate_hz' => $result['display']['refresh_rate_hz'],
                'result' => [...$result, 'server_reasons' => $evaluation['reasons']],
            ]);
            if ($evaluation['verdict'] !== 'fail') {
                $this->states->transition($session, SessionStatus::Ready, 'player', $session->id, "calibration {$evaluation['verdict']}");
            }
        });

        return [...$evaluation, 'status' => $session->status->value];
    }

    /** Starts the run; the server chooses the seed so the trial order is not client-controlled. */
    public function start(TestSession $session): int
    {
        $seed = random_int(0, 4294967295);
        DB::transaction(function () use ($session, $seed) {
            $this->states->transition($session, SessionStatus::Running, 'player', $session->id, null, [
                'seed' => $seed,
                'started_at' => now(),
            ]);
            $this->auth->revokeInvites($session);
        });

        return $seed;
    }

    /**
     * The player announces the last sequence it recorded. The session
     * completes as soon as every event up to it has been stored — now, or
     * later when the outbox has drained.
     */
    public function announceCompletion(TestSession $session, int $finalSequence): bool
    {
        if ($finalSequence < 1) {
            throw new ApiException('final_sequence must be positive.', 'invalid_final_sequence', 422);
        }
        if ($session->status === SessionStatus::Running) {
            if ($finalSequence < $session->last_sequence) {
                throw new ApiException('final_sequence is behind the stored events.', 'invalid_final_sequence', 422);
            }
            $this->states->transition($session, SessionStatus::Uploading, 'player', $session->id, null, [
                'expected_final_sequence' => $finalSequence,
            ]);
        } elseif ($session->status !== SessionStatus::Uploading || $session->expected_final_sequence !== $finalSequence) {
            throw InvalidSessionTransition::between($session->status, SessionStatus::Uploading);
        }

        return $this->completeIfFullyUploaded($session);
    }

    public function completeIfFullyUploaded(TestSession $session): bool
    {
        $completed = DB::transaction(function () use ($session) {
            $locked = TestSession::query()->lockForUpdate()->findOrFail($session->id);
            if ($locked->status !== SessionStatus::Uploading || $locked->last_sequence < $locked->expected_final_sequence) {
                return false;
            }
            $this->states->transition($session, SessionStatus::Completed, 'system', null, 'all events received', [
                'completed_at' => now(),
            ]);
            $this->auth->revokeAll($session);

            return true;
        });

        if ($completed) {
            ScoreSessionJob::dispatch($session->id, $session->tenant_id)->afterCommit();
        }

        return $completed;
    }

    public function cancel(TestSession $session, User $by, ?string $reason): void
    {
        DB::transaction(function () use ($session, $by, $reason) {
            $this->states->transition($session, SessionStatus::Cancelled, 'user', $by->id, $reason);
            $this->auth->revokeAll($session);
        });
    }
}
