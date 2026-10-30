<?php

namespace App\Domain\Audit;

use App\Domain\Tenancy\TenantContext;
use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/** Records security-relevant actions (who did what to which record). */
final class AuditLogger
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly Request $request,
    ) {}

    public function log(string $action, ?Model $subject = null, array $metadata = [], ?string $tenantId = null): void
    {
        AuditLog::create([
            'tenant_id' => $tenantId ?? $this->context->id(),
            'actor_id' => $this->request->user()?->getAuthIdentifier(),
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'ip' => $this->request->ip(),
            'user_agent' => substr((string) $this->request->userAgent(), 0, 255),
            'metadata' => $metadata,
        ]);
    }
}
