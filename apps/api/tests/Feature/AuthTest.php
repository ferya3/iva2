<?php

namespace Tests\Feature;

use App\Domain\Tenancy\TenantRole;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_login_returns_an_expiring_token(): void
    {
        $user = User::factory()->create(['email' => 'dr@example.ir']);

        $res = $this->postJson('/api/v1/auth/login', ['email' => 'DR@example.ir', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);

        $this->assertNotNull($res->json('expires_at'));
        $this->withToken($res->json('token'))->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('user.email', 'dr@example.ir');
    }

    public function test_wrong_password_is_rejected_and_rate_limited(): void
    {
        User::factory()->create(['email' => 'dr@example.ir']);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'nope'])
                ->assertStatus(422)->assertJsonPath('code', 'invalid_credentials');
        }
        $this->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'password'])
            ->assertStatus(429)->assertJsonPath('code', 'too_many_attempts');
    }

    public function test_rate_limits_follow_the_client_behind_the_panel_proxy(): void
    {
        User::factory()->create(['email' => 'dr@example.ir']);
        $fromPanel = fn (string $client) => $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
            ->withHeader('X-Forwarded-For', $client)
            ->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'nope']);

        for ($i = 0; $i < 5; $i++) {
            $fromPanel('5.5.5.5')->assertStatus(422);
        }
        $fromPanel('5.5.5.5')->assertStatus(429);
        // Another browser behind the same Next.js server is not locked out.
        $fromPanel('6.6.6.6')->assertStatus(422);
    }

    public function test_public_clients_cannot_spoof_their_address(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '91.99.1.2'])->withHeader('X-Forwarded-For', '1.2.3.4')
            ->postJson('/api/v1/auth/login', ['email' => 'x@example.ir', 'password' => 'nope']);
        $this->assertTrue(RateLimiter::attempts('login:x@example.ir|91.99.1.2') === 1);
    }

    public function test_unauthenticated_requests_get_json_401_without_accept_header(): void
    {
        $this->get('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_new_members_get_a_one_time_password(): void
    {
        $this->actingAsClinic();
        $password = $this->postJson('/api/v1/tenant/members', ['email' => 'new@clinic.ir', 'name' => 'Dr New', 'role' => 'clinician'])
            ->assertCreated()->json('temporary_password');
        $this->assertNotEmpty($password);
        $this->postJson('/api/v1/auth/login', ['email' => 'new@clinic.ir', 'password' => $password])->assertOk();
    }

    public function test_new_member_credentials_include_the_login_address(): void
    {
        config(['cognitest.clinic_web_url' => 'https://82.115.25.8/']);
        $this->actingAsClinic();
        $res = $this->postJson('/api/v1/tenant/members', ['email' => 'New@clinic.ir', 'name' => 'Dr New', 'role' => 'clinician'])
            ->assertCreated()
            ->assertJsonPath('credentials.email', 'new@clinic.ir')
            ->assertJsonPath('credentials.name', 'Dr New')
            ->assertJsonPath('credentials.login_url', 'https://82.115.25.8/login');
        $this->assertSame($res->json('temporary_password'), $res->json('credentials.password'));
    }

    public function test_clinic_managers_issue_a_new_password_for_their_members(): void
    {
        [$tenant] = $this->actingAsClinic();
        $member = $this->postJson('/api/v1/tenant/members', ['email' => 'dr@clinic.ir', 'name' => 'Dr', 'role' => 'clinician'])->json('data.id');
        $user = User::query()->where('email', 'dr@clinic.ir')->first();
        $user->createToken('old');

        $password = $this->postJson("/api/v1/tenant/members/{$member}/reset-password")
            ->assertOk()->assertJsonPath('credentials.email', 'dr@clinic.ir')->json('credentials.password');

        $this->assertSame(0, $user->tokens()->count());
        $this->postJson('/api/v1/auth/login', ['email' => 'dr@clinic.ir', 'password' => $password])->assertOk();
    }

    public function test_member_password_reset_is_refused_for_owners_and_shared_accounts(): void
    {
        [$tenant, $owner] = $this->actingAsClinic();
        $ownerMembership = $this->getJson('/api/v1/tenant/members')->json('data.0.id');
        $this->postJson("/api/v1/tenant/members/{$ownerMembership}/reset-password")->assertStatus(409)->assertJsonPath('code', 'owner_immutable');

        // A user who also works at another clinic is not this clinic's to take over.
        $shared = User::factory()->create(['email' => 'shared@clinic.ir']);
        $this->system(fn () => app(\App\Domain\Tenancy\TenantProvisioner::class)->provision(['name' => 'Other'], $shared, 'starter'));
        $member = $this->postJson('/api/v1/tenant/members', ['email' => 'shared@clinic.ir', 'role' => 'clinician'])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/tenant/members/{$member}/reset-password")->assertStatus(409)->assertJsonPath('code', 'shared_account');
        $this->postJson('/api/v1/auth/login', ['email' => 'shared@clinic.ir', 'password' => 'password'])->assertOk();
    }

    public function test_members_without_management_permission_cannot_reset_passwords(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $this->postJson('/api/v1/tenant/members/1/reset-password')->assertForbidden();
    }

    public function test_users_change_their_own_password(): void
    {
        $user = User::factory()->create(['email' => 'dr@example.ir']);
        $other = $user->createToken('other-device')->plainTextToken;
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'password'])->json('token');

        $this->withToken($token)->postJson('/api/v1/auth/password', [
            'current_password' => 'wrong', 'password' => 'N3w-password', 'password_confirmation' => 'N3w-password',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->withToken($token)->postJson('/api/v1/auth/password', [
            'current_password' => 'password', 'password' => 'N3w-password', 'password_confirmation' => 'N3w-password',
        ])->assertOk();

        // This session stays signed in; other devices are signed out.
        $this->assertSame(1, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'N3w-password'])->assertOk();
    }

    public function test_inactive_users_cannot_log_in(): void
    {
        User::factory()->create(['email' => 'off@example.ir', 'is_active' => false]);
        $this->postJson('/api/v1/auth/login', ['email' => 'off@example.ir', 'password' => 'password'])->assertStatus(422);
    }

    public function test_me_lists_memberships_with_permissions(): void
    {
        [$tenant] = $this->actingAsClinic(TenantRole::Assistant);

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('memberships.0.tenant_id', $tenant->id)
            ->assertJsonPath('memberships.0.role', 'assistant')
            ->assertJsonMissingPath('memberships.0.permissions.6');
    }

    public function test_refresh_rotates_the_token(): void
    {
        User::factory()->create(['email' => 'dr@example.ir']);
        $old = $this->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'password'])->json('token');

        $new = $this->withToken($old)->postJson('/api/v1/auth/refresh')->assertOk()->json('token');

        $this->assertNotSame($old, $new);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_logout_revokes_the_token(): void
    {
        User::factory()->create(['email' => 'dr@example.ir']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'dr@example.ir', 'password' => 'password'])->json('token');
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
