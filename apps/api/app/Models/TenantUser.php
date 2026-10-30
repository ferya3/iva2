<?php

namespace App\Models;

use App\Domain\Tenancy\Permission as PermissionEnum;
use App\Domain\Tenancy\RolePermissions;
use App\Domain\Tenancy\TenantRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Membership of a user in a clinic. Not tenant-scoped itself: it is how the
 * tenant context is resolved in the first place (queried by user_id).
 */
class TenantUser extends Model
{
    protected $fillable = ['tenant_id', 'user_id', 'role', 'status', 'invited_by'];

    protected function casts(): array
    {
        return ['role' => TenantRole::class];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return list<string> */
    public function permissions(): array
    {
        return app(RolePermissions::class)->for($this->role->value);
    }

    public function hasPermission(PermissionEnum $permission): bool
    {
        return $this->status === 'active' && in_array($permission->value, $this->permissions(), true);
    }
}
