<?php

namespace App\Domain\Tenancy;

use App\Models\Role;
use Illuminate\Support\Facades\Cache;

/**
 * Role → permission lookup backed by the roles/permissions tables, cached
 * because it is consulted on every authorised request.
 */
final class RolePermissions
{
    private const CACHE_KEY = 'rbac:role_permissions:v1';

    private ?array $memo = null;

    /** @return list<string> */
    public function for(string $role): array
    {
        $this->memo ??= Cache::rememberForever(self::CACHE_KEY, fn () => Role::query()
            ->with('permissions:id,key')
            ->get()
            ->mapWithKeys(fn (Role $r) => [$r->key => $r->permissions->pluck('key')->all()])
            ->all());

        return $this->memo[$role] ?? [];
    }

    public function flush(): void
    {
        $this->memo = null;
        Cache::forget(self::CACHE_KEY);
    }
}
