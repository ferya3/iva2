<?php

namespace App\Http\Middleware;

use App\Domain\Sessions\PlayerAuth;
use App\Domain\Tenancy\TenantContext;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates the desktop player by its per-session access token and
 * binds the request to that session (and its tenant). The token can only
 * act on the session in the URL.
 */
final class AuthenticatePlayer
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly PlayerAuth $auth,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken()
            ?? throw new ApiException('Player token required.', 'player_unauthenticated', 401);
        $session = $this->auth->resolveAccessToken($token);

        $routeSession = $request->route('session');
        $routeId = is_object($routeSession) ? $routeSession->getKey() : $routeSession;
        if ($routeId !== null && $routeId !== $session->id) {
            throw new ApiException('Token is not valid for this session.', 'player_forbidden', 403);
        }

        $this->context->set($session->tenant);
        $request->attributes->set('player_session', $session);

        return $next($request);
    }

    public function terminate(): void
    {
        $this->context->clear();
    }
}
