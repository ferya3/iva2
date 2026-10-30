<?php

namespace App\Http\Middleware;

use App\Domain\Tenancy\TenantContext;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Platform administration (admin-web). Runs the request in system context,
 * i.e. across tenants with RLS bypassed — hence a separate, audited surface.
 */
final class RequirePlatformAdmin
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isPlatformAdmin()) {
            throw new ApiException('Platform administrator access required.', 'platform_admin_required', 403);
        }

        return $this->context->runAsSystem(fn () => $next($request));
    }
}
