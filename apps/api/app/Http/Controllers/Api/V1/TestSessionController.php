<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Domain\Norms\NormScorer;
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

    /**
     * Creates a session. With assessment_type_id the version is chosen from
     * the patient's age (the published version whose age range contains
     * it); an explicit assessment_version_id outside the patient's age range
     * needs allow_age_override, which is audited.
     */
    public function store(Request $request, QuotaGuard $quota, TenantContext $context, AuditLogger $audit): TestSessionResource
    {
        $data = $request->validate([
            'patient_id' => ['required', 'uuid'],
            'assessment_type_id' => ['required_without:assessment_version_id', 'nullable', 'uuid'],
            'assessment_version_id' => ['required_without:assessment_type_id', 'nullable', 'uuid'],
            'allow_age_override' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $patient = Patient::query()->with('profile')->findOrFail($data['patient_id']);
        $age = $patient->profile?->ageYears();
        $override = false;

        if (! empty($data['assessment_version_id'])) {
            $version = AssessmentVersion::query()->published()->find($data['assessment_version_id'])
                ?? throw new ApiException('Assessment version is not available.', 'assessment_unavailable', 422);
            if (! $version->coversAge($age)) {
                if (! ($data['allow_age_override'] ?? false)) {
                    throw new ApiException(
                        $age === null ? 'The patient has no birth date; this version is age-restricted.' : 'This version is not meant for the patient\'s age.',
                        $age === null ? 'age_required' : 'age_out_of_range',
                        422,
                        ['age_years' => $age, 'min_age_years' => $version->min_age_years, 'max_age_years' => $version->max_age_years],
                    );
                }
                $override = true;
            }
        } else {
            $version = AssessmentVersion::query()->published()
                ->where('assessment_type_id', $data['assessment_type_id'])
                ->forAge($age)
                ->orderByDesc('published_at')
                ->first();
            if (! $version) {
                $published = AssessmentVersion::query()->published()->where('assessment_type_id', $data['assessment_type_id'])->exists();
                throw match (true) {
                    ! $published => new ApiException('Assessment is not available.', 'assessment_unavailable', 422),
                    $age === null => new ApiException('Enter the patient\'s birth date so the age-appropriate version can be chosen.', 'age_required', 422),
                    default => new ApiException('No version of this assessment is meant for the patient\'s age.', 'no_version_for_age', 422, ['age_years' => $age]),
                };
            }
        }
        $quota->ensureCanCreateSession($context->tenant());

        $session = TestSession::create([
            'patient_id' => $patient->id,
            'assessment_version_id' => $version->id,
            'created_by' => $request->user()->id,
            'notes' => $data['notes'] ?? null,
        ]);
        $audit->log('session.created', $session, array_filter([
            'assessment_version' => $version->version,
            'age_years' => $age,
            'age_override' => $override ?: null,
        ], fn ($v) => $v !== null));

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

    public function results(TestSession $session, NormScorer $norms): JsonResponse
    {
        $run = $session->latestSucceededRun()->with(['metrics', 'validity'])->first()
            ?? throw new ApiException('No results yet.', 'not_scored', 404);
        $comparison = $norms->score($session, $run->metrics);

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
            // Live comparison with the currently published norms (reports freeze theirs).
            'norms' => $comparison ? [
                ...$comparison['set'],
                'age_years' => $comparison['age_years'],
                'sex' => $comparison['sex'],
                'scores' => array_values($comparison['scores']),
            ] : null,
        ]);
    }
}
