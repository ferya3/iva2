<?php

use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\TenantContext;
use App\Models\TestSession;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('sessions:expire-invites', function (TenantContext $context, SessionStateMachine $states) {
    $count = $context->runAsSystem(function () use ($states) {
        $n = 0;
        TestSession::query()
            ->where('status', SessionStatus::Invited)
            ->where('expires_at', '<', now())
            ->each(function (TestSession $s) use ($states, &$n) {
                $states->transition($s, SessionStatus::Expired, 'system', null, 'invite expired');
                $n++;
            });

        return $n;
    });
    $this->info("Expired {$count} session(s).");
})->purpose('Mark sessions whose invite expired before the player joined');

Schedule::command('sessions:expire-invites')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
