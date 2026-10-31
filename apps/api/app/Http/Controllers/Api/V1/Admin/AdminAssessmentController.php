<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditLogger;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\AssessmentTypeResource;
use App\Http\Resources\AssessmentVersionResource;
use App\Models\AssessmentProtocol;
use App\Models\AssessmentType;
use App\Models\AssessmentVersion;
use App\Models\ScoringVersion;
use App\Models\ValidationRule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Catalogue management. Versions are created as drafts with their full
 * definition (protocol, validation rules, scoring version) and become
 * immutable on publish.
 */
class AdminAssessmentController extends Controller
{
    private const AGE_RULES = [
        'min_age_years' => ['nullable', 'integer', 'min:0', 'max:120'],
        'max_age_years' => ['nullable', 'integer', 'min:0', 'max:120'],
        'audience_label' => ['nullable', 'string', 'max:64'],
    ];

    public function index(): AnonymousResourceCollection
    {
        return AssessmentTypeResource::collection(
            AssessmentType::query()->with(['versions' => fn ($q) => $q->orderByDesc('created_at')])->orderBy('name')->get()
        );
    }

    public function storeType(Request $request): AssessmentTypeResource
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'unique:assessment_types,key'],
            'name' => ['required', 'string', 'max:120'],
            'name_en' => ['nullable', 'string', 'max:120'],
            'category' => ['required', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        return new AssessmentTypeResource(AssessmentType::create($data));
    }

    public function storeVersion(Request $request, AssessmentType $type): AssessmentVersionResource
    {
        $data = $request->validate([
            // Optional suffix names a variant of the same release, e.g. 1.1.0-child.
            'version' => ['required', 'string', 'max:32', 'regex:/^\d+\.\d+\.\d+(-[a-z0-9]+)?$/'],
            'is_clinical' => ['required', 'boolean'],
            'estimated_duration_seconds' => ['required', 'integer', 'min:1'],
            'min_engine_version' => ['nullable', 'string', 'max:32'],
            ...self::AGE_RULES,
            'protocol' => ['required', 'array'],
            'protocol.key' => ['required', 'string'],
            'protocol.version' => ['required', 'string', 'same:version'],
            'protocol.blocks' => ['required', 'array', 'min:1'],
            'protocol.stimuli' => ['required', 'array', 'min:1'],
            'protocol.timing' => ['required', 'array'],
            'protocol.response' => ['required', 'array'],
            'validation_rules' => ['nullable', 'array'],
            'scoring' => ['required', 'array'],
            'scoring.algorithm_version' => ['required', 'string', 'max:64'],
            'scoring.config' => ['nullable', 'array'],
        ]);
        $this->ensureAgeRange($data);
        if ($type->versions()->where('version', $data['version'])->exists()) {
            throw new ApiException('This version already exists.', 'version_exists', 409);
        }

        $version = DB::transaction(function () use ($type, $data) {
            $version = $type->versions()->create([
                'version' => $data['version'],
                'status' => 'draft',
                'is_clinical' => $data['is_clinical'],
                'estimated_duration_seconds' => $data['estimated_duration_seconds'],
                'min_engine_version' => $data['min_engine_version'] ?? '1.0.0',
                'min_age_years' => $data['min_age_years'] ?? null,
                'max_age_years' => $data['max_age_years'] ?? null,
                'audience_label' => $data['audience_label'] ?? null,
            ]);
            AssessmentProtocol::create(['assessment_version_id' => $version->id, 'config' => $data['protocol']]);
            ValidationRule::create(['assessment_version_id' => $version->id, 'rules' => $data['validation_rules'] ?? []]);
            ScoringVersion::create([
                'assessment_version_id' => $version->id,
                'algorithm_version' => $data['scoring']['algorithm_version'],
                'config' => $data['scoring']['config'] ?? [],
                'is_default' => true,
            ]);

            return $version;
        });

        return new AssessmentVersionResource($version->load('protocol'));
    }

    /** Changes who a version is for (age range); allowed after publishing. */
    public function updateEligibility(Request $request, AssessmentVersion $version, AuditLogger $audit): AssessmentVersionResource
    {
        $data = $request->validate(self::AGE_RULES);
        $this->ensureAgeRange($data);
        $version->update($data);
        $audit->log('admin.assessment.eligibility_updated', $version, $data);

        return new AssessmentVersionResource($version);
    }

    public function publish(AssessmentVersion $version, AuditLogger $audit): AssessmentVersionResource
    {
        if ($version->status !== 'draft') {
            throw new ApiException('Only drafts can be published.', 'not_draft', 409);
        }
        $version->update(['status' => 'published', 'published_at' => now()]);
        $audit->log('admin.assessment.published', $version);

        return new AssessmentVersionResource($version);
    }

    public function retire(AssessmentVersion $version, AuditLogger $audit): AssessmentVersionResource
    {
        if ($version->status !== 'published') {
            throw new ApiException('Only published versions can be retired.', 'not_published', 409);
        }
        $version->update(['status' => 'retired']);
        $audit->log('admin.assessment.retired', $version);

        return new AssessmentVersionResource($version);
    }

    private function ensureAgeRange(array $data): void
    {
        if (isset($data['min_age_years'], $data['max_age_years']) && $data['max_age_years'] < $data['min_age_years']) {
            throw ValidationException::withMessages(['max_age_years' => 'The maximum age must not be below the minimum age.']);
        }
    }
}
