<?php

namespace App\Providers;

use App\Domain\Reports\ChromiumPdfRenderer;
use App\Domain\Reports\PdfRenderer;
use App\Domain\Scoring\NodeScoringEngine;
use App\Domain\Scoring\ScoringEngine;
use App\Domain\Tenancy\RolePermissions;
use App\Domain\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(TenantContext::class);
        $this->app->singleton(RolePermissions::class);

        $this->app->bind(ScoringEngine::class, fn () => new NodeScoringEngine(
            config('cognitest.scoring.node_binary'),
            $this->resolvePath(config('cognitest.scoring.cli_path')),
            config('cognitest.scoring.timeout'),
        ));
        $this->app->bind(PdfRenderer::class, fn () => new ChromiumPdfRenderer(
            config('cognitest.reports.chromium_binary'),
            config('cognitest.reports.timeout'),
        ));
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());

        RateLimiter::for('auth', fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
        RateLimiter::for('player-join', fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
        // Generous: a 30-minute session uploads a few dozen batches, but
        // reconnect storms after an outage must not lock the player out.
        RateLimiter::for('player', fn (Request $r) => Limit::perMinute(240)->by((string) $r->bearerToken() ?: $r->ip()));
    }

    private function resolvePath(string $path): string
    {
        return str_starts_with($path, '/') ? $path : base_path($path);
    }
}
