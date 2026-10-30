<?php

namespace App\Jobs;

use App\Domain\Scoring\ScoreSession;
use App\Domain\Tenancy\TenantContext;
use App\Models\Tenant;
use App\Models\TestSession;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class ScoreSessionJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [10, 60, 300];

    public function __construct(
        public readonly string $sessionId,
        public readonly string $tenantId,
        public readonly ?string $requestedBy = null,
    ) {
        $this->onQueue('scoring');
    }

    public function uniqueId(): string
    {
        return $this->sessionId;
    }

    public function handle(TenantContext $context, ScoreSession $scorer): void
    {
        $tenant = $context->runAsSystem(fn () => Tenant::findOrFail($this->tenantId));
        $context->runAs($tenant, function () use ($scorer) {
            $scorer->run(TestSession::findOrFail($this->sessionId), $this->requestedBy);
        });
    }
}
