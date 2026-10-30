<?php

namespace App\Domain\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

final class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $context = app(TenantContext::class);
        if ($context->isSystem()) {
            return;
        }
        // Fail closed: without a tenant no tenant-owned row is visible.
        $builder->where($model->qualifyColumn('tenant_id'), $context->id());
    }
}
