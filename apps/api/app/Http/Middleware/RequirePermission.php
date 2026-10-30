<?php

namespace App\Http\Middleware;

use App\Domain\Tenancy\Permission;
use App\Domain\Tenancy\TenantContext;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Usage: ->middleware('permission:patients.manage') */
final class RequirePermission
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        foreach ($permissions as $permission) {
            if (! $this->context->allows(Permission::from($permission))) {
                throw new ApiException('You are not allowed to perform this action.', 'permission_denied', 403, ['permission' => $permission]);
            }
        }

        return $next($request);
    }
}
