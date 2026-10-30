<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Domain\Tenancy\TenantContext;
use App\Domain\Tenancy\TenantProvisioner;
use App\Http\Controllers\Controller;
use App\Http\Resources\TenantResource;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $tenants = Tenant::query()
            ->whereIn('id', $request->user()->memberships()->where('status', 'active')->select('tenant_id'))
            ->orderBy('name')
            ->get();

        return TenantResource::collection($tenants);
    }

    /** Self-service clinic sign-up: the creator becomes owner on a trial plan. */
    public function store(Request $request, TenantProvisioner $provisioner): TenantResource
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'unique:tenants,slug'],
            'city' => ['nullable', 'string', 'max:64'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        return new TenantResource($provisioner->provision($data, $request->user()));
    }

    public function show(TenantContext $context): TenantResource
    {
        return new TenantResource($context->tenant()->loadCount('members'));
    }

    public function update(Request $request, TenantContext $context, AuditLogger $audit): TenantResource
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'city' => ['sometimes', 'nullable', 'string', 'max:64'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'license_number' => ['sometimes', 'nullable', 'string', 'max:64'],
        ]);
        $tenant = $context->tenant();
        $tenant->update($data);
        $audit->log('tenant.updated', $tenant, ['fields' => array_keys($data)]);

        return new TenantResource($tenant);
    }
}
