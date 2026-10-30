<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AssessmentTypeResource;
use App\Http\Resources\AssessmentVersionResource;
use App\Models\AssessmentType;
use App\Models\AssessmentVersion;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Read-only catalogue for clinics: only published versions are offered. */
class AssessmentCatalogController extends Controller
{
    public function types(): AnonymousResourceCollection
    {
        return AssessmentTypeResource::collection(
            AssessmentType::query()
                ->whereHas('versions', fn ($q) => $q->published())
                ->with(['versions' => fn ($q) => $q->published()->orderByDesc('published_at')])
                ->orderBy('name')
                ->get()
        );
    }

    public function versions(): AnonymousResourceCollection
    {
        return AssessmentVersionResource::collection(
            AssessmentVersion::query()->published()->with('type')->orderByDesc('published_at')->get()
        );
    }
}
