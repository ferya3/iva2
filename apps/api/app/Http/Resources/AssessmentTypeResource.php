<?php

namespace App\Http\Resources;

use App\Models\AssessmentType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AssessmentType */
class AssessmentTypeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'name' => $this->name,
            'name_en' => $this->name_en,
            'category' => $this->category,
            'description' => $this->description,
            'versions' => AssessmentVersionResource::collection($this->whenLoaded('versions')),
        ];
    }
}
