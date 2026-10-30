<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditLogger;
use App\Domain\Tenancy\TenantProvisioner;
use App\Http\Controllers\Controller;
use App\Http\Resources\TenantResource;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminTenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return TenantResource::collection(
            Tenant::query()
                ->withCount('members')
                ->when($request->input('q'), fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'ilike', "%{$s}%")->orWhere('slug', 'ilike', "%{$s}%")))
                ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
                ->latest()
                ->paginate(25)
        );
    }

    public function store(Request $request, TenantProvisioner $provisioner): TenantResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'unique:tenants,slug'],
            'city' => ['nullable', 'string', 'max:64'],
            'owner_email' => ['required', 'email'],
            'owner_name' => ['required', 'string', 'max:120'],
            'plan' => ['nullable', 'exists:plans,key'],
        ]);
        $owner = User::query()->firstOrCreate(
            ['email' => Str::lower($data['owner_email'])],
            ['name' => $data['owner_name'], 'password' => Str::password(32)],
        );

        return new TenantResource($provisioner->provision($data, $owner, $data['plan'] ?? 'starter'));
    }

    public function update(Request $request, Tenant $tenant, AuditLogger $audit): TenantResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(['active', 'trial', 'suspended'])],
        ]);
        $tenant->update($data);
        $audit->log('admin.tenant.updated', $tenant, $data, $tenant->id);

        return new TenantResource($tenant);
    }
}
