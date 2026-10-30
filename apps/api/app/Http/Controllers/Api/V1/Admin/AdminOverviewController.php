<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Sessions\SessionStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminOverviewController extends Controller
{
    public function stats(): JsonResponse
    {
        $byStatus = TestSession::query()->select('status', DB::raw('count(*) as n'))->groupBy('status')->pluck('n', 'status');
        $perDay = TestSession::query()
            ->where('created_at', '>=', now()->subDays(29)->startOfDay())
            ->selectRaw("to_char(created_at, 'YYYY-MM-DD') as day, count(*) as n")
            ->groupBy('day')->orderBy('day')->pluck('n', 'day');

        return response()->json([
            'tenants' => Tenant::query()->count(),
            'active_tenants' => Tenant::query()->whereIn('status', ['active', 'trial'])->count(),
            'users' => User::query()->count(),
            'sessions' => $byStatus->sum(),
            'sessions_by_status' => collect(SessionStatus::cases())->mapWithKeys(fn ($s) => [$s->value => (int) ($byStatus[$s->value] ?? 0)]),
            'sessions_per_day' => $perDay,
            'active_subscriptions' => Subscription::query()->whereIn('status', ['active', 'trialing'])->count(),
        ]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        return response()->json(
            AuditLog::query()
                ->with('actor:id,name,email')
                ->when($request->input('tenant_id'), fn ($q, $t) => $q->where('tenant_id', $t))
                ->when($request->input('action'), fn ($q, $a) => $q->where('action', 'like', "{$a}%"))
                ->latest('id')
                ->paginate(50)
        );
    }

    public function users(Request $request): JsonResponse
    {
        return response()->json(
            User::query()
                ->withCount('memberships')
                ->when($request->input('q'), fn ($q, $s) => $q->where('email', 'ilike', "%{$s}%")->orWhere('name', 'ilike', "%{$s}%"))
                ->latest()
                ->paginate(25, ['id', 'name', 'email', 'platform_role', 'is_active', 'last_login_at', 'created_at'])
        );
    }
}
