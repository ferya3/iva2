<?php

namespace App\Domain\Tenancy;

use App\Models\Tenant;
use App\Models\TenantUser;
use Closure;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * The tenant every query of the current unit of work is scoped to.
 *
 * Isolation is enforced twice: Eloquent's TenantScope adds
 * `tenant_id = ?` to every query of tenant-owned models, and PostgreSQL RLS
 * (keyed on the `app.tenant_id` setting written here) rejects rows of other
 * tenants even for raw SQL.
 */
final class TenantContext
{
    private ?Tenant $tenant = null;

    private ?TenantUser $membership = null;

    private bool $system = false;

    public function set(Tenant $tenant, ?TenantUser $membership = null): void
    {
        $this->tenant = $tenant;
        $this->membership = $membership;
        $this->system = false;
        $this->apply();
    }

    public function clear(): void
    {
        $this->tenant = null;
        $this->membership = null;
        $this->system = false;
        $this->apply();
    }

    public function has(): bool
    {
        return $this->tenant !== null;
    }

    public function tenant(): Tenant
    {
        return $this->tenant ?? throw new LogicException('No tenant in context.');
    }

    public function id(): ?string
    {
        return $this->tenant?->getKey();
    }

    public function membership(): ?TenantUser
    {
        return $this->membership;
    }

    public function isSystem(): bool
    {
        return $this->system;
    }

    public function allows(Permission $permission): bool
    {
        return $this->membership?->hasPermission($permission) ?? false;
    }

    /** Runs $callback scoped to $tenant and restores the previous context. */
    public function runAs(Tenant $tenant, Closure $callback): mixed
    {
        $previous = [$this->tenant, $this->membership, $this->system];
        $this->set($tenant);
        try {
            return $callback();
        } finally {
            [$this->tenant, $this->membership, $this->system] = $previous;
            $this->apply();
        }
    }

    /**
     * Runs $callback with RLS bypassed and no tenant scope (platform admin,
     * cross-tenant lookups such as resolving a player token). Use sparingly.
     */
    public function runAsSystem(Closure $callback): mixed
    {
        $previous = [$this->tenant, $this->membership, $this->system];
        $this->tenant = null;
        $this->membership = null;
        $this->system = true;
        $this->apply();
        try {
            return $callback();
        } finally {
            [$this->tenant, $this->membership, $this->system] = $previous;
            $this->apply();
        }
    }

    private function apply(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }
        DB::select(
            "SELECT set_config('app.tenant_id', ?, false), set_config('app.bypass_rls', ?, false)",
            [$this->tenant?->getKey() ?? '', $this->system ? 'on' : 'off'],
        );
    }
}
