<?php

namespace App\Domain\Tenancy;

use App\Domain\Audit\AuditLogger;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantSetting;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TenantProvisioner
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function provision(array $data, User $owner, string $planKey = 'starter', int $trialDays = 14): Tenant
    {
        return DB::transaction(function () use ($data, $owner, $planKey, $trialDays) {
            $tenant = Tenant::create([
                'name' => $data['name'],
                'slug' => $data['slug'] ?? $this->uniqueSlug($data['name']),
                'status' => 'trial',
                'city' => $data['city'] ?? null,
                'phone' => $data['phone'] ?? null,
            ]);
            TenantUser::create(['tenant_id' => $tenant->id, 'user_id' => $owner->id, 'role' => TenantRole::Owner, 'status' => 'active']);

            $this->context->runAs($tenant, function () use ($tenant, $planKey, $trialDays) {
                TenantSetting::create(['tenant_id' => $tenant->id, 'settings' => ['locale' => 'fa', 'calendar' => 'jalali']]);
                if ($plan = Plan::query()->where('key', $planKey)->first()) {
                    Subscription::create([
                        'tenant_id' => $tenant->id,
                        'plan_id' => $plan->id,
                        'status' => 'trialing',
                        'starts_at' => now(),
                        'ends_at' => now()->addDays($trialDays),
                    ]);
                }
                $this->audit->log('tenant.created', $tenant);
            });

            return $tenant;
        });
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'clinic';
        $slug = $base;
        while (Tenant::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(4));
        }

        return $slug;
    }
}
