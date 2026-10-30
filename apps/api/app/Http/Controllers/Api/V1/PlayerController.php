<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Events\EventBatchValidator;
use App\Domain\Events\EventIngestor;
use App\Domain\Sessions\PlayerAuth;
use App\Domain\Sessions\SessionLifecycle;
use App\Domain\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Http\Requests\CalibrationRequest;
use App\Http\Requests\DeviceCheckRequest;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Endpoints used by the desktop player. Authenticated by the per-session
 * player token (AuthenticatePlayer), never by clinic user credentials.
 */
class PlayerController extends Controller
{
    public function join(Request $request, PlayerAuth $auth, TenantContext $context): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:16'],
            'device_id' => ['required', 'string', 'max:64'],
        ]);
        ['session' => $session, 'token' => $token, 'expires_at' => $expires] = $auth->join($data['code'], $data['device_id'], $request->ip());

        return response()->json([
            'token' => $token,
            'expires_at' => $expires->toIso8601String(),
            'session' => $context->runAs($session->tenant, fn () => $this->describe($session)),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['session' => $this->describe($this->session($request))]);
    }

    public function deviceCheck(DeviceCheckRequest $request, SessionLifecycle $lifecycle): JsonResponse
    {
        $session = $this->session($request);
        $lifecycle->recordDeviceCheck($session, $request->validated());

        return response()->json(['status' => $session->status->value]);
    }

    public function calibration(CalibrationRequest $request, SessionLifecycle $lifecycle): JsonResponse
    {
        return response()->json($lifecycle->recordCalibration($this->session($request), $request->validated()));
    }

    public function start(Request $request, SessionLifecycle $lifecycle): JsonResponse
    {
        $session = $this->session($request);
        $seed = $lifecycle->start($session);

        return response()->json(['status' => $session->status->value, 'seed' => $seed, 'started_at' => $session->started_at->toIso8601String()]);
    }

    public function events(Request $request, EventBatchValidator $validator, EventIngestor $ingestor): JsonResponse
    {
        $batch = $validator->validate($request->json()->all());
        $result = $ingestor->ingest($this->session($request), $batch);

        return response()->json($result->toArray(), $result->duplicate ? 200 : 201);
    }

    public function complete(Request $request, SessionLifecycle $lifecycle): JsonResponse
    {
        $data = $request->validate(['final_sequence' => ['required', 'integer', 'min:1']]);
        $session = $this->session($request);
        $completed = $lifecycle->announceCompletion($session, $data['final_sequence']);

        return response()->json([
            'status' => $session->status->value,
            'last_sequence' => $session->last_sequence,
            'missing_from' => $completed ? null : $session->last_sequence + 1,
        ], $completed ? 200 : 202);
    }

    private function session(Request $request): TestSession
    {
        return $request->attributes->get('player_session');
    }

    private function describe(TestSession $session): array
    {
        $version = $session->assessmentVersion()->with(['type', 'protocol', 'validationRules', 'assets'])->first();

        return [
            'id' => $session->id,
            'status' => $session->status->value,
            'patient_code' => $session->patient->patient_code,
            'clinic_name' => $session->tenant->name,
            'last_sequence' => $session->last_sequence,
            'seed' => $session->seed,
            'assessment' => [
                'key' => $version->type->key,
                'name' => $version->type->name,
                'version' => $version->version,
                'is_clinical' => $version->is_clinical,
                'min_engine_version' => $version->min_engine_version,
                'protocol' => $version->protocol?->config,
                'protocol_sha256' => $version->protocol?->config_sha256,
                'calibration_thresholds' => $version->validationRules?->rules['calibration'] ?? null,
                'assets' => $version->assets->map(fn ($a) => [
                    'key' => $a->asset_key,
                    'sha256' => $a->sha256,
                    'size_bytes' => $a->size_bytes,
                    'mime_type' => $a->mime_type,
                ])->values(),
            ],
        ];
    }
}
