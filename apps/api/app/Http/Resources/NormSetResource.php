<?php

namespace App\Http\Resources;

use App\Models\NormSet;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin NormSet */
class NormSetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'assessment_version_id' => $this->assessment_version_id,
            'assessment' => $this->whenLoaded('assessmentVersion', fn () => [
                'name' => $this->assessmentVersion->type?->name,
                'version' => $this->assessmentVersion->version,
                'audience' => $this->assessmentVersion->audience_label,
            ]),
            'name' => $this->name,
            'version' => $this->version,
            'status' => $this->status,
            'provisional' => $this->provisional,
            'source' => $this->source,
            'entries_count' => $this->whenCounted('entries'),
            'coverage' => $this->whenLoaded('entries', fn () => [
                'metrics' => $this->entries->map(fn ($e) => "{$e->scope}.{$e->metric_key}")->unique()->values(),
                'age_min_years' => $this->entries->min('age_min_years'),
                'age_max_years' => $this->entries->max('age_max_years'),
                'sexes' => $this->entries->pluck('sex')->unique()->values(),
                'min_n' => $this->entries->min('n'),
            ]),
            'entries' => $this->when($request->routeIs('admin.norm-sets.show'), fn () => $this->entries->map(fn ($e) => [
                'scope' => $e->scope,
                'metric_key' => $e->metric_key,
                'sex' => $e->sex,
                'age_min_years' => $e->age_min_years,
                'age_max_years' => $e->age_max_years,
                'mean' => $e->mean,
                'sd' => $e->sd,
                'n' => $e->n,
                'direction' => $e->direction,
            ])),
            'published_at' => $this->published_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
