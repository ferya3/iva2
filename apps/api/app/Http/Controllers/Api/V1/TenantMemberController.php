<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Domain\Tenancy\QuotaGuard;
use App\Domain\Tenancy\TenantContext;
use App\Domain\Tenancy\TenantRole;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TenantMemberController extends Controller
{
    public function __construct(private readonly TenantContext $context) {}

    public function index(): AnonymousResourceCollection
    {
        return MemberResource::collection(
            TenantUser::query()->where('tenant_id', $this->context->id())->with('user')->orderBy('created_at')->get()
        );
    }

    /**
     * Adds an existing user by e-mail, or creates the account. New accounts
     * get a random password and must use password reset to sign in.
     */
    public function store(Request $request, QuotaGuard $quota, AuditLogger $audit): MemberResource
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'name' => ['nullable', 'string', 'max:120'],
            'role' => ['required', Rule::enum(TenantRole::class)->except([TenantRole::Owner])],
        ]);
        $tenant = $this->context->tenant();
        $quota->ensureCanAddMember($tenant);

        $user = User::query()->where('email', Str::lower($data['email']))->first();
        if (! $user) {
            if (empty($data['name'])) {
                throw ValidationException::withMessages(['name' => 'Name is required for a new account.']);
            }
            $user = User::create(['email' => Str::lower($data['email']), 'name' => $data['name'], 'password' => Str::password(32)]);
        }
        if (TenantUser::query()->where('tenant_id', $tenant->id)->where('user_id', $user->id)->exists()) {
            throw new ApiException('User is already a member of this clinic.', 'already_member', 409);
        }
        $member = TenantUser::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role' => $data['role'],
            'status' => 'active',
            'invited_by' => $request->user()->id,
        ]);
        $audit->log('member.added', $member, ['role' => $data['role']]);

        return new MemberResource($member->load('user'));
    }

    public function update(Request $request, int $member, AuditLogger $audit): MemberResource
    {
        $data = $request->validate([
            'role' => ['sometimes', Rule::enum(TenantRole::class)->except([TenantRole::Owner])],
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
        ]);
        $membership = $this->find($member);
        if ($membership->role === TenantRole::Owner) {
            throw new ApiException('The clinic owner cannot be changed here.', 'owner_immutable', 409);
        }
        $membership->update($data);
        $audit->log('member.updated', $membership, $data);

        return new MemberResource($membership->load('user'));
    }

    public function destroy(int $member, AuditLogger $audit): Response
    {
        $membership = $this->find($member);
        if ($membership->role === TenantRole::Owner) {
            throw new ApiException('The clinic owner cannot be removed.', 'owner_immutable', 409);
        }
        $membership->delete();
        $audit->log('member.removed', $membership);

        return response()->noContent();
    }

    private function find(int $id): TenantUser
    {
        return TenantUser::query()->where('tenant_id', $this->context->id())->findOrFail($id);
    }
}
