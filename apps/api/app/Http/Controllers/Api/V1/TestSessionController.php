<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Domain\Scoring\ScoreSession;
use App\Domain\Sessions\PlayerAuth;
use App\Domain\Sessions\SessionLifecycle;
use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\QuotaGuard;
use App\Domain\Tenancy\TenantContext;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\TestSessionResource;
use App\Jobs\ScoreSessionJob;
use App\Models\AssessmentVersion;
use App\Models\Patient;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class TestSessionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(SessionStatus::class)],
            'patient_id' => ['nullable', 'uuid'],
            'pending' => ['nullable', 'boolean'],
        ]);

        return TestSessionResource::collection(
            TestSession::query()
                ->with(['patient', 'assessmentVersion.type'])
                ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
                ->when($request->input('patient_id'), fn ($q, $p) => $q->where('patient_id', $p))
                ->when($request->boolean('pending'), fn ($q) => $q->whereIn('status', SessionStatus::pending()))
                ->latest()
                ->paginate($request->integer('per_page', 20))
        );
    }

    public function store(Request $request, QuotaGuard $quota, TenantContext $context, AuditLogger $audit): TestSessionResource
    {
        $data = $request->validate([
            'patient_id' => ['required', 'uuid'],
            'assessment_version_id' => ['required', 'uuid'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $patient = Patient::query()->findOrFail($data['patient_id']);
        $version = AssessmentVersion::query()->published()->find($data['assessment_version_id'])
            ?? throw new ApiException('Assessment version is not available.', 'assessment_unavailable', 422);
        $quota->ensureCanCreateSession($context->tenant());

        $session = TestSession::create([
            'patient_id' => $patient->id,
            'assessment_version_id' => $version->id,
            'created_by' => $request->user()->id,
            'notes' => $data['notes'] ?? null,
        ]);
        $audit->log('session.created', $session);

        return new TestSessionResource($session->load(['patient', 'assessmentVersion.type']));
    }

    public function show(TestSession $session): TestSessionResource
    {
        return new TestSessionResource($session->load(['patient', 'assessmentVersion.type', 'latestCalibration', 'states']));
    }

    public function invite(Request $request, TestSession $session, PlayerAuth $auth, AuditLogger $audit): JsonResponse
    {
        ['code' => $code, 'expires_at' => $expires] = $auth->createInvite($session, $request->user());
        $audit->log('session.invited', $session);
        $scheme = config('cognitest.deep_link_scheme');

        return response()->json([
            'session_id' => $session->id,
            'code' => $code,
            'deep_link' => "{$scheme}://join?code={$code}",
            'expires_at' => $expires->toIso8601String(),
        ], 201);
    }

    public function cancel(Request $request, TestSession $session, SessionLifecycle $lifecycle, AuditLogger $audit): TestSessionResource
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $lifecycle->cancel($session, $request->user(), $data['reason'] ?? null);
        $audit->log('session.cancelled', $session);

        return new TestSessionResource($session);
    }

    /** Queues a (re-)scoring run. */
    public function score(Request $request, TestSession $session): JsonResponse
    {
        if (! in_array($session->status, ScoreSession::SCORABLE, true)) {
            throw new ApiException('Session has no complete data to score yet.', 'session_not_scorable', 409, ['status' => $session->status->value]);
        }
        ScoreSessionJob::dispatch($session->id, $session->tenant_id, $request->user()->id);

        return response()->json(['message' => 'Scoring queued.'], 202);
    }

    public function results(TestSession $session): JsonResponse
    {
        $run = $session->latestSucceededRun()->with(['metrics', 'validity'])->first()
            ?? throw new ApiException('No results yet.', 'not_scored', 404);

        return response()->json([
            'session_id' => $session->id,
            'scoring_run_id' => $run->id,
            'algorithm_version' => $run->algorithm_version,
            'validity_status' => $run->validity->validity_status,
            'quality_flags' => $run->validity->flags,
            'metrics' => $run->metrics->map(fn ($m) => [
                'key' => $m->metric_key,
                'value' => $m->value,
                'unit' => $m->unit,
                'scope' => $m->scope,
            ])->values(),
            'scored_at' => $run->finished_at->toIso8601String(),
        ]);
    }
}
