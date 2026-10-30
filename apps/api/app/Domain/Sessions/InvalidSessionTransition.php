<?php

namespace App\Domain\Sessions;

use App\Exceptions\ApiException;

final class InvalidSessionTransition extends ApiException
{
    public static function between(SessionStatus $from, SessionStatus $to): self
    {
        return new self(
            "Session cannot move from {$from->value} to {$to->value}.",
            'invalid_session_transition',
            409,
            ['from' => $from->value, 'to' => $to->value],
        );
    }
}
