<?php

namespace App\Domain\Tenancy;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * For every model that stores tenant_id: scopes reads to the current tenant
 * and stamps tenant_id on create (refusing cross-tenant writes).
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function ($model) {
            $context = app(TenantContext::class);
            if ($model->tenant_id === null) {
                $model->tenant_id = $context->id()
                    ?? throw new LogicException(static::class.' created without tenant context.');
            } elseif ($context->has() && $model->tenant_id !== $context->id()) {
                throw new LogicException('Refusing to write '.static::class.' into another tenant.');
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
