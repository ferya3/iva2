<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditLogger;
use App\Domain\Tenancy\AccountCredentials;
use App\Domain\Tenancy\TenantRole;
use App\Exceptions\ApiException;
use App\Domain\Tenancy\TenantProvisioner;
use App\Http\Controllers\Controller;
use App\Http\Resources\TenantResource;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
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
                ->with('ownerMembership.user')
                ->when($request->input('q'), fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'ilike', "%{$s}%")->orWhere('slug', 'ilike', "%{$s}%")))
                ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
                ->latest()
                ->paginate(25)
        );
    }

    /**
     * Provisions a clinic. When the owner account is new, its sign-in
     * details are returned once (credentials; owner_temporary_password is
     * kept for older clients) so the platform admin can hand them over; the
     * password is never stored in plain text.
     */
    public function store(Request $request, TenantProvisioner $provisioner): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'unique:tenants,slug'],
            'city' => ['nullable', 'string', 'max:64'],
            'owner_email' => ['required', 'email'],
            'owner_name' => ['required', 'string', 'max:120'],
            'plan' => ['nullable', 'exists:plans,key'],
        ]);
        $temporaryPassword = null;
        $owner = User::query()->where('email', Str::lower($data['owner_email']))->first();
        if (! $owner) {
            $temporaryPassword = AccountCredentials::generatePassword();
            $owner = User::create(['email' => Str::lower($data['owner_email']), 'name' => $data['owner_name'], 'password' => $temporaryPassword]);
        }
        $tenant = $provisioner->provision($data, $owner, $data['plan'] ?? 'starter');

        return (new TenantResource($tenant->load('ownerMembership.user')))
            ->additional([
                'owner_temporary_password' => $temporaryPassword,
                'credentials' => $temporaryPassword ? AccountCredentials::payload($owner, $temporaryPassword) : null,
                'login_url' => AccountCredentials::loginUrl(),
            ])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Issues a new temporary password for the clinic owner (e.g. the first
     * one was lost) and signs them out everywhere. Platform administrators'
     * own accounts are only reset from the server console.
     */
    public function resetOwnerPassword(Tenant $tenant, AuditLogger $audit): JsonResponse
    {
        $membership = TenantUser::query()->where('tenant_id', $tenant->id)
            ->where('role', TenantRole::Owner->value)->with('user')->first();
        if (! $membership?->user) {
            throw new ApiException('This clinic has no owner account.', 'owner_missing', 404);
        }
        $owner = $membership->user;
        if ($owner->isPlatformAdmin()) {
            throw new ApiException('Platform administrator passwords are reset from the server console.', 'platform_admin_protected', 409);
        }
        $password = AccountCredentials::reset($owner);
        $audit->log('admin.tenant.owner_password_reset', $owner, ['tenant_id' => $tenant->id], $tenant->id);

        return response()->json(['credentials' => AccountCredentials::payload($owner, $password)]);
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
