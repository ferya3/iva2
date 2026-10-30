<?php

namespace App\Http\Resources;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tenant */
class TenantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'status' => $this->status,
            'city' => $this->city,
            'phone' => $this->phone,
            'license_number' => $this->license_number,
            'created_at' => $this->created_at?->toIso8601String(),
            'members_count' => $this->whenCounted('members'),
        ];
    }
}
