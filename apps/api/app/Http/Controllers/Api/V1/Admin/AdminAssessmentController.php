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

/**
 * Catalogue management. Versions are created as drafts with their full
 * definition (protocol, validation rules, scoring version) and become
 * immutable on publish.
 */
class AdminAssessmentController extends Controller
{
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
            'version' => ['required', 'string', 'max:32', 'regex:/^\d+\.\d+\.\d+$/'],
            'is_clinical' => ['required', 'boolean'],
            'estimated_duration_seconds' => ['required', 'integer', 'min:1'],
            'min_engine_version' => ['nullable', 'string', 'max:32'],
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
}
