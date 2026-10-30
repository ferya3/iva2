<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePatientRequest;
use App\Http\Resources\PatientResource;
use App\Http\Resources\TestSessionResource;
use App\Models\Consent;
use App\Models\Guardian;
use App\Models\Patient;
use App\Models\PatientProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    private const PROFILE_FIELDS = ['first_name', 'last_name', 'national_id', 'birth_date', 'sex', 'handedness', 'education', 'phone'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['nullable', 'string', 'max:100'], 'per_page' => ['nullable', 'integer', 'between:5,100']]);
        $q = trim((string) $request->input('q'));

        $patients = Patient::query()
            ->with('profile')
            ->withCount('sessions')
            ->when($q !== '', function ($query) use ($q) {
                $digits = preg_replace('/\D/', '', $q);
                $query->where(function ($w) use ($q, $digits) {
                    $w->where('patient_code', 'ilike', "%{$q}%")
                        ->orWhereHas('profile', fn ($p) => $p->where('last_name', 'ilike', "%{$q}%")->orWhere('first_name', 'ilike', "%{$q}%"));
                    if (strlen($digits) === 10) {
                        $w->orWhereHas('profile', fn ($p) => $p->where('national_id_hash', PatientProfile::blindIndex($digits)));
                    }
                });
            })
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return PatientResource::collection($patients);
    }

    public function store(StorePatientRequest $request, AuditLogger $audit): PatientResource
    {
        $data = $request->validated();
        $patient = DB::transaction(function () use ($data, $request) {
            $patient = Patient::create([
                'patient_code' => $data['patient_code'] ?? $this->nextCode(),
                'created_by' => $request->user()->id,
            ]);
            PatientProfile::create(['patient_id' => $patient->id, ...Arr::only($data, self::PROFILE_FIELDS)]);
            if (! empty($data['guardian'])) {
                Guardian::create(['patient_id' => $patient->id, ...$data['guardian']]);
            }
            if (! empty($data['consent'])) {
                Consent::create([
                    'patient_id' => $patient->id,
                    'consent_type' => 'assessment',
                    'version' => $data['consent']['version'],
                    'accepted_by_name' => $data['consent']['accepted_by_name'],
                    'accepted_at' => now(),
                    'recorded_by' => $request->user()->id,
                ]);
            }

            return $patient;
        });
        $audit->log('patient.created', $patient);

        return new PatientResource($patient->load('profile'));
    }

    public function show(Patient $patient, AuditLogger $audit): PatientResource
    {
        $audit->log('patient.viewed', $patient);

        return new PatientResource($patient->load('profile')->loadCount('sessions'));
    }

    public function update(StorePatientRequest $request, Patient $patient, AuditLogger $audit): PatientResource
    {
        $data = $request->validated();
        DB::transaction(function () use ($patient, $data) {
            if (isset($data['patient_code'])) {
                $patient->update(['patient_code' => $data['patient_code']]);
            }
            $patient->profile()->updateOrCreate(['patient_id' => $patient->id], Arr::only($data, self::PROFILE_FIELDS));
        });
        $audit->log('patient.updated', $patient, ['fields' => array_keys($data)]);

        return new PatientResource($patient->load('profile'));
    }

    public function destroy(Patient $patient, AuditLogger $audit): Response
    {
        $patient->delete();
        $audit->log('patient.deleted', $patient);

        return response()->noContent();
    }

    public function sessions(Patient $patient): AnonymousResourceCollection
    {
        return TestSessionResource::collection(
            $patient->sessions()->with('assessmentVersion.type')->latest()->paginate(20)
        );
    }

    private function nextCode(): string
    {
        $count = Patient::withTrashed()->count();
        do {
            $code = 'P-'.str_pad((string) (++$count + 1000), 5, '0', STR_PAD_LEFT);
        } while (Patient::withTrashed()->where('patient_code', $code)->exists());

        return $code;
    }
}
