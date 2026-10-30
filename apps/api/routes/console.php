<?php

use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\PlatformRole;
use App\Domain\Tenancy\TenantContext;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Str;

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

Artisan::command('cognitest:create-admin {email} {--name=مدیر سامانه} {--password=}', function (string $email) {
    $password = $this->option('password') ?: Str::password(20, symbols: false);
    $user = User::query()->updateOrCreate(['email' => Str::lower($email)], [
        'name' => $this->option('name'),
        'password' => $password,
        'platform_role' => PlatformRole::SuperAdmin,
        'is_active' => true,
    ]);
    $this->info("Platform administrator: {$user->email}");
    if (! $this->option('password')) {
        $this->line("Password: {$password}");
    }
})->purpose('Create (or reset) a platform administrator account');

Schedule::command('sessions:expire-invites')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
