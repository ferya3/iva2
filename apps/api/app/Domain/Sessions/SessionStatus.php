<?php

namespace App\Domain\Sessions;

/**
 * Mirrors packages/shared-types/src/session-status.ts. The transition
 * matrix is pinned by tests on both sides (SessionStatusTest / vitest).
 */
enum SessionStatus: string
{
    case Created = 'CREATED';
    case Invited = 'INVITED';
    case DeviceCheck = 'DEVICE_CHECK';
    case Calibration = 'CALIBRATION';
    case Ready = 'READY';
    case Running = 'RUNNING';
    case Uploading = 'UPLOADING';
    case Completed = 'COMPLETED';
    case Validated = 'VALIDATED';
    case Reported = 'REPORTED';
    case Invalid = 'INVALID';
    case Cancelled = 'CANCELLED';
    case Expired = 'EXPIRED';

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Created => [self::Invited, self::Cancelled],
            self::Invited => [self::DeviceCheck, self::Cancelled, self::Expired],
            self::DeviceCheck => [self::Calibration, self::Cancelled],
            self::Calibration => [self::Ready, self::DeviceCheck, self::Cancelled],
            self::Ready => [self::Running, self::Cancelled],
            self::Running => [self::Uploading, self::Invalid],
            self::Uploading => [self::Completed, self::Invalid],
            self::Completed => [self::Validated, self::Invalid],
            self::Validated => [self::Reported],
            self::Reported, self::Invalid, self::Cancelled, self::Expired => [],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return $this->allowedTransitions() === [];
    }

    public function acceptsEvents(): bool
    {
        return in_array($this, [self::Running, self::Uploading], true);
    }

    /** Sessions the player may (re)join with an invite. */
    public function isJoinable(): bool
    {
        return in_array($this, [self::Invited, self::DeviceCheck, self::Calibration, self::Ready], true);
    }

    public function hasResults(): bool
    {
        return in_array($this, [self::Validated, self::Reported, self::Invalid], true);
    }

    /** @return list<self> */
    public static function pending(): array
    {
        return [self::Created, self::Invited, self::DeviceCheck, self::Calibration, self::Ready, self::Running, self::Uploading];
    }
}
