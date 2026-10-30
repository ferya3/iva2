<?php

namespace Database\Seeders;

use App\Domain\Tenancy\Permission as PermissionEnum;
use App\Domain\Tenancy\RolePermissions;
use App\Domain\Tenancy\TenantRole;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/** Idempotent: syncs the roles/permissions tables with the enums. */
class RbacSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PermissionEnum::cases() as $p) {
            Permission::query()->updateOrCreate(['key' => $p->value]);
        }
        foreach (TenantRole::cases() as $r) {
            $role = Role::query()->updateOrCreate(['key' => $r->value], ['name' => $r->label(), 'scope' => 'tenant']);
            $role->permissions()->sync(Permission::query()->whereIn('key', $r->defaultPermissions())->pluck('id'));
        }
        app(RolePermissions::class)->flush();
    }
}
