<?php

use App\Http\Middleware\AuthenticatePlayer;
use App\Http\Middleware\LimitRequestSize;
use App\Http\Middleware\RequirePermission;
use App\Http\Middleware\RequirePlatformAdmin;
use App\Http\Middleware\ResolveTenant;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// PDO converts bound PHP floats to strings using `precision` (default 14
// significant digits), which would silently round millisecond timestamps
// before they reach DOUBLE PRECISION columns. -1 selects the shortest
// representation that round-trips exactly. Pinned by EventIngestTest.
ini_set('precision', '-1');

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'permission' => RequirePermission::class,
            'platform.admin' => RequirePlatformAdmin::class,
            'auth.player' => AuthenticatePlayer::class,
            'body.limit' => LimitRequestSize::class,
        ]);
        // Tenant/system context must exist before route-model binding runs,
        // so bound models are resolved through the tenant scope.
        $middleware->prependToPriorityList(SubstituteBindings::class, ResolveTenant::class);
        $middleware->prependToPriorityList(SubstituteBindings::class, AuthenticatePlayer::class);
        $middleware->prependToPriorityList(SubstituteBindings::class, RequirePlatformAdmin::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        // Never reveal model class names or whether a record exists in another tenant.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') && $e->getPrevious() instanceof ModelNotFoundException) {
                return response()->json(['message' => 'Not found.', 'code' => 'not_found'], 404);
            }
        });
    })->create();
