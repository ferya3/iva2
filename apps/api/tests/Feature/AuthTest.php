<?php

namespace Tests\Feature;

use App\Domain\Tenancy\TenantRole;
use App\Models\User;
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
