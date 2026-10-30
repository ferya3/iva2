<?php

use App\Http\Controllers\Api\V1\Admin\AdminAssessmentController;
use App\Http\Controllers\Api\V1\Admin\AdminOverviewController;
use App\Http\Controllers\Api\V1\Admin\AdminPlanController;
use App\Http\Controllers\Api\V1\Admin\AdminTenantController;
use App\Http\Controllers\Api\V1\AssessmentCatalogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PlayerController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\TenantMemberController;
use App\Http\Controllers\Api\V1\TestSessionController;
use Illuminate\Support\Facades\Route;

/*
| Cognitest API v1 — https://api.cognitest.ir/api/v1/
|
| Three audiences, three authentication schemes:
|   clinic-web / admin-web  → Sanctum bearer token (+ X-Tenant-ID for clinic routes)
|   desktop player          → per-session player token (auth.player)
*/

foreach (['session', 'patient', 'report', 'tenant', 'version', 'type'] as $param) {
    Route::pattern($param, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');
}

Route::prefix('v1')->group(function () {
    // ---- Authentication ---------------------------------------------------
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/refresh', [AuthController::class, 'refresh']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // Clinics the user belongs to / self-service creation.
        Route::get('tenants', [TenantController::class, 'index']);
        Route::post('tenants', [TenantController::class, 'store'])->middleware('throttle:10,60');

        // ---- Tenant-scoped (X-Tenant-ID) ----------------------------------
        Route::middleware('tenant')->group(function () {
            Route::get('tenant', [TenantController::class, 'show']);
            Route::patch('tenant', [TenantController::class, 'update'])->middleware('permission:tenant.manage');
            Route::get('dashboard', DashboardController::class);

            Route::middleware('permission:members.manage')->group(function () {
                Route::get('tenant/members', [TenantMemberController::class, 'index']);
                Route::post('tenant/members', [TenantMemberController::class, 'store']);
                Route::patch('tenant/members/{member}', [TenantMemberController::class, 'update'])->whereNumber('member');
                Route::delete('tenant/members/{member}', [TenantMemberController::class, 'destroy'])->whereNumber('member');
            });

            Route::get('patients', [PatientController::class, 'index'])->middleware('permission:patients.view');
            Route::post('patients', [PatientController::class, 'store'])->middleware('permission:patients.manage');
            Route::get('patients/{patient}', [PatientController::class, 'show'])->middleware('permission:patients.view')->name('patients.show');
            Route::patch('patients/{patient}', [PatientController::class, 'update'])->middleware('permission:patients.manage');
            Route::delete('patients/{patient}', [PatientController::class, 'destroy'])->middleware('permission:patients.manage');
            Route::get('patients/{patient}/sessions', [PatientController::class, 'sessions'])->middleware('permission:sessions.view');

            Route::get('assessment-types', [AssessmentCatalogController::class, 'types']);
            Route::get('assessment-versions', [AssessmentCatalogController::class, 'versions']);

            Route::get('sessions', [TestSessionController::class, 'index'])->middleware('permission:sessions.view');
            Route::post('sessions', [TestSessionController::class, 'store'])->middleware('permission:sessions.manage');
            Route::get('sessions/{session}', [TestSessionController::class, 'show'])->middleware('permission:sessions.view');
            Route::post('sessions/{session}/invite', [TestSessionController::class, 'invite'])->middleware('permission:sessions.manage');
            Route::post('sessions/{session}/cancel', [TestSessionController::class, 'cancel'])->middleware('permission:sessions.manage');
            Route::get('sessions/{session}/results', [TestSessionController::class, 'results'])->middleware('permission:reports.view');
            Route::post('sessions/{session}/score', [TestSessionController::class, 'score'])->middleware('permission:reports.generate');

            Route::get('sessions/{session}/report', [ReportController::class, 'showForSession'])->middleware('permission:reports.view');
            Route::post('sessions/{session}/reports', [ReportController::class, 'store'])->middleware('permission:reports.generate');
            Route::post('reports/{report}/generate', [ReportController::class, 'generatePdf'])->middleware('permission:reports.generate');
            Route::get('reports/{report}/download', [ReportController::class, 'download'])->middleware('permission:reports.view');
        });

        // ---- Platform administration (admin-web) ---------------------------
        Route::prefix('admin')->middleware('platform.admin')->group(function () {
            Route::get('stats', [AdminOverviewController::class, 'stats']);
            Route::get('audit-logs', [AdminOverviewController::class, 'auditLogs']);
            Route::get('users', [AdminOverviewController::class, 'users']);
            Route::get('tenants', [AdminTenantController::class, 'index']);
            Route::post('tenants', [AdminTenantController::class, 'store']);
            Route::patch('tenants/{tenant}', [AdminTenantController::class, 'update']);
            Route::get('plans', [AdminPlanController::class, 'index']);
            Route::post('plans', [AdminPlanController::class, 'store']);
            Route::patch('plans/{plan}', [AdminPlanController::class, 'update']);
            Route::get('assessments', [AdminAssessmentController::class, 'index']);
            Route::post('assessment-types', [AdminAssessmentController::class, 'storeType']);
            Route::post('assessment-types/{type}/versions', [AdminAssessmentController::class, 'storeVersion']);
            Route::post('assessment-versions/{version}/publish', [AdminAssessmentController::class, 'publish']);
            Route::post('assessment-versions/{version}/retire', [AdminAssessmentController::class, 'retire']);
        });
    });

    // ---- Desktop player ---------------------------------------------------
    Route::post('player/join', [PlayerController::class, 'join'])->middleware('throttle:player-join');

    Route::middleware(['auth.player', 'throttle:player'])->group(function () {
        Route::get('player/session', [PlayerController::class, 'show']);
        Route::post('sessions/{session}/device-check', [PlayerController::class, 'deviceCheck']);
        Route::post('sessions/{session}/calibration', [PlayerController::class, 'calibration']);
        Route::post('sessions/{session}/start', [PlayerController::class, 'start']);
        Route::post('sessions/{session}/events/batch', [PlayerController::class, 'events'])
            ->middleware('body.limit:'.config('cognitest.events.max_request_kb'));
        Route::post('sessions/{session}/complete', [PlayerController::class, 'complete']);
    });
});
