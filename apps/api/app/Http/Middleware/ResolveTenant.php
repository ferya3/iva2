<?php

namespace App\Http\Middleware;

use App\Domain\Tenancy\TenantContext;
use App\Exceptions\ApiException;
use App\Models\TenantUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active clinic from the X-Tenant-ID header and verifies the
 * authenticated user is an active member of it. Every tenant-scoped route
 * sits behind this middleware.
 */
final class ResolveTenant
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = (string) $request->header('X-Tenant-ID');
        if (! preg_match('/^[0-9a-f-]{36}$/i', $tenantId)) {
            throw new ApiException('X-Tenant-ID header is required.', 'tenant_required', 400);
        }

        $membership = TenantUser::query()
            ->with('tenant')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $request->user()->getAuthIdentifier())
            ->where('status', 'active')
            ->first();

        // Same response for "no such tenant" and "not a member": no enumeration.
        if (! $membership || ! $membership->tenant) {
            throw new ApiException('You do not have access to this clinic.', 'tenant_forbidden', 403);
        }
        if (! $membership->tenant->isActive()) {
            throw new ApiException('This clinic is suspended.', 'tenant_suspended', 403);
        }

        $this->context->set($membership->tenant, $membership);

        return $next($request);
    }

    public function terminate(): void
    {
        $this->context->clear();
    }
}
