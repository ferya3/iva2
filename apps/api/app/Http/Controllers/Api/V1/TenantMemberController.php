<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Domain\Tenancy\AccountCredentials;
use App\Domain\Tenancy\QuotaGuard;
use App\Domain\Tenancy\TenantContext;
use App\Domain\Tenancy\TenantRole;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
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
     * Adds an existing user by e-mail, or creates the account. For a new
     * account its sign-in details are returned once (credentials;
     * temporary_password is kept for older clients).
     */
    public function store(Request $request, QuotaGuard $quota, AuditLogger $audit): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'name' => ['nullable', 'string', 'max:120'],
            'role' => ['required', Rule::enum(TenantRole::class)->except([TenantRole::Owner])],
        ]);
        $tenant = $this->context->tenant();
        $quota->ensureCanAddMember($tenant);

        $temporaryPassword = null;
        $user = User::query()->where('email', Str::lower($data['email']))->first();
        if (! $user) {
            if (empty($data['name'])) {
                throw ValidationException::withMessages(['name' => 'Name is required for a new account.']);
            }
            $temporaryPassword = AccountCredentials::generatePassword();
            $user = User::create(['email' => Str::lower($data['email']), 'name' => $data['name'], 'password' => $temporaryPassword]);
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

        return (new MemberResource($member->load('user')))
            ->additional([
                'temporary_password' => $temporaryPassword,
                'credentials' => $temporaryPassword ? AccountCredentials::payload($user, $temporaryPassword) : null,
                'login_url' => AccountCredentials::loginUrl(),
            ])
            ->response()
            ->setStatusCode(201);
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

    /**
     * Issues a new temporary password for a member who lost theirs. Only for
     * accounts that belong to this clinic alone: a shared account (another
     * clinic, or the platform staff) is not this clinic's to take over.
     */
    public function resetPassword(Request $request, int $member, AuditLogger $audit): JsonResponse
    {
        $membership = $this->find($member)->load('user');
        $user = $membership->user;
        if ($membership->role === TenantRole::Owner) {
            throw new ApiException('The clinic owner\'s password is reset by the platform administrator.', 'owner_immutable', 409);
        }
        if ($user->is($request->user())) {
            throw new ApiException('Change your own password from your account page.', 'own_account', 409);
        }
        $elsewhere = $this->context->runAsSystem(fn () => TenantUser::query()
            ->where('user_id', $user->id)->where('tenant_id', '!=', $membership->tenant_id)->exists());
        if ($elsewhere || $user->isPlatformAdmin()) {
            throw new ApiException('This account is also used outside this clinic; its owner must reset it.', 'shared_account', 409);
        }
        $password = AccountCredentials::reset($user);
        $audit->log('member.password_reset', $membership);

        return response()->json(['credentials' => AccountCredentials::payload($user, $password)]);
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
