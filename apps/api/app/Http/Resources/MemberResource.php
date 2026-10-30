<?php

namespace App\Http\Resources;

use App\Models\TenantUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TenantUser */
class MemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'name' => $this->user->name,
            'email' => $this->user->email,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'status' => $this->status,
            'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
