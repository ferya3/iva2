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
