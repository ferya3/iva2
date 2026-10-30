<?php

namespace App\Domain\Tenancy;

use App\Exceptions\ApiException;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\TestSession;

/** Enforces plan limits of the tenant's current subscription. */
final class QuotaGuard
{
    public function currentSubscription(Tenant $tenant): ?Subscription
    {
        return Subscription::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['active', 'trialing'])
            ->where('starts_at', '<=', now())
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->with('plan')
            ->latest('starts_at')
            ->first();
    }

    public function ensureCanCreateSession(Tenant $tenant): void
    {
        $subscription = $this->currentSubscription($tenant)
            ?? throw new ApiException('The clinic has no active subscription.', 'subscription_required', 402);
        $limit = $subscription->plan->limit('sessions_per_month');
        if ($limit === null) {
            return;
        }
        $used = TestSession::query()
            ->where('tenant_id', $tenant->id)
            ->where('created_at', '>=', now()->startOfMonth())
            ->count();
        if ($used >= $limit) {
            throw new ApiException('Monthly assessment quota reached.', 'quota_exceeded', 402, ['limit' => $limit, 'used' => $used]);
        }
    }

    public function ensureCanAddMember(Tenant $tenant): void
    {
        $limit = $this->currentSubscription($tenant)?->plan->limit('clinicians');
        if ($limit === null) {
            return;
        }
        $count = TenantUser::query()->where('tenant_id', $tenant->id)->where('status', 'active')->count();
        if ($count >= $limit) {
            throw new ApiException('Member limit of the current plan reached.', 'quota_exceeded', 402, ['limit' => $limit]);
        }
    }
}
