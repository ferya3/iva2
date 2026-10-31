<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditLogger;
use App\Domain\Norms\NormCsv;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\NormSetResource;
use App\Models\AssessmentVersion;
use App\Models\NormSet;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Norm tables per assessment version. Sets are uploaded as CSV drafts,
 * reviewed, then published; one published set per version is applied to
 * new reports (published sets are immutable, corrections are new versions).
 */
class AdminNormController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return NormSetResource::collection(
            NormSet::query()
                ->when($request->input('assessment_version_id'), fn ($q, $id) => $q->where('assessment_version_id', $id))
                ->with(['assessmentVersion.type', 'entries'])
                ->withCount('entries')
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function show(NormSet $normSet): NormSetResource
    {
        return new NormSetResource($normSet->load(['assessmentVersion.type', 'entries'])->loadCount('entries'));
    }

    public function store(Request $request, AssessmentVersion $version, AuditLogger $audit): NormSetResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'version' => ['required', 'string', 'max:32', 'regex:/^\d+\.\d+(\.\d+)?$/'],
            'provisional' => ['required', 'boolean'],
            'source' => ['nullable', 'string', 'max:2000'],
            'csv' => ['required', 'string', 'max:2000000'],
        ]);
        if ($version->normSets()->where('version', $data['version'])->exists()) {
            throw new ApiException('This norm set version already exists.', 'version_exists', 409);
        }
        $rows = NormCsv::parse($data['csv']);

        $set = DB::transaction(function () use ($version, $data, $rows, $request) {
            $set = $version->normSets()->create([
                ...collect($data)->except('csv')->all(),
                'status' => 'draft',
                'created_by' => $request->user()->id,
            ]);
            foreach (array_chunk($rows, 500) as $chunk) {
                $set->entries()->createMany($chunk);
            }

            return $set;
        });
        $audit->log('admin.norms.created', $set, ['entries' => count($rows)]);

        return new NormSetResource($set->load(['assessmentVersion.type', 'entries'])->loadCount('entries'));
    }

    /** Publishing replaces the version's current norms for new reports; existing reports keep theirs. */
    public function publish(NormSet $normSet, AuditLogger $audit): NormSetResource
    {
        if ($normSet->status !== 'draft') {
            throw new ApiException('Only drafts can be published.', 'not_draft', 409);
        }
        DB::transaction(function () use ($normSet) {
            NormSet::query()->published()->where('assessment_version_id', $normSet->assessment_version_id)->update(['status' => 'retired']);
            $normSet->update(['status' => 'published', 'published_at' => now()]);
        });
        $audit->log('admin.norms.published', $normSet);

        return $this->show($normSet);
    }

    public function retire(NormSet $normSet, AuditLogger $audit): NormSetResource
    {
        if ($normSet->status !== 'published') {
            throw new ApiException('Only published norm sets can be retired.', 'not_published', 409);
        }
        $normSet->update(['status' => 'retired']);
        $audit->log('admin.norms.retired', $normSet);

        return $this->show($normSet);
    }

    public function destroy(NormSet $normSet, AuditLogger $audit): Response
    {
        if ($normSet->status !== 'draft') {
            throw new ApiException('Only drafts can be deleted.', 'not_draft', 409);
        }
        $normSet->delete();
        $audit->log('admin.norms.deleted', $normSet);

        return response()->noContent();
    }
}
