<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\QuotaGuard;
use App\Domain\Tenancy\TenantContext;
use App\Domain\Tenancy\TenantRole;
use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\TenantUser;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(TenantContext $context, QuotaGuard $quota): JsonResponse
    {
        $tenant = $context->tenant();
        $subscription = $quota->currentSubscription($tenant);
        $done = [SessionStatus::Completed, SessionStatus::Validated, SessionStatus::Reported];

        return response()->json([
            'patients' => Patient::query()->count(),
            'completed_sessions' => TestSession::query()->whereIn('status', $done)->count(),
            'pending_sessions' => TestSession::query()->whereIn('status', SessionStatus::pending())->count(),
            'invalid_sessions' => TestSession::query()->where('status', SessionStatus::Invalid)->count(),
            'clinicians' => TenantUser::query()->where('tenant_id', $tenant->id)->where('status', 'active')
                ->whereIn('role', [TenantRole::Clinician, TenantRole::Owner, TenantRole::Admin])->count(),
            'sessions_this_month' => TestSession::query()->where('created_at', '>=', now()->startOfMonth())->count(),
            'subscription' => $subscription ? [
                'plan' => $subscription->plan->name,
                'status' => $subscription->status,
                'ends_at' => $subscription->ends_at?->toIso8601String(),
                'sessions_per_month' => $subscription->plan->limit('sessions_per_month'),
            ] : null,
            'recent_sessions' => TestSession::query()->with('patient')->latest()->limit(8)->get()->map(fn ($s) => [
                'id' => $s->id,
                'patient_code' => $s->patient->patient_code,
                'status' => $s->status->value,
                'validity_status' => $s->validity_status,
                'created_at' => $s->created_at->toIso8601String(),
            ]),
        ]);
    }
}
