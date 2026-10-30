<?php

namespace App\Http\Resources;

use App\Models\AssessmentVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AssessmentVersion */
class AssessmentVersionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'assessment_type_id' => $this->assessment_type_id,
            'type' => new AssessmentTypeResource($this->whenLoaded('type')),
            'version' => $this->version,
            'status' => $this->status,
            'is_clinical' => $this->is_clinical,
            'estimated_duration_seconds' => $this->estimated_duration_seconds,
            'published_at' => $this->published_at?->toIso8601String(),
            'protocol' => $this->when($this->relationLoaded('protocol') && $request->user()?->isPlatformAdmin(), fn () => $this->protocol?->config),
        ];
    }
}
