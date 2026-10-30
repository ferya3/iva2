<?php

namespace App\Http\Resources;

use App\Models\TenantUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TenantUser */
class MembershipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'tenant_id' => $this->tenant_id,
            'tenant_name' => $this->tenant->name,
            'tenant_slug' => $this->tenant->slug,
            'role' => $this->role->value,
            'permissions' => $this->permissions(),
        ];
    }
}
