<?php

namespace Tests\Feature;

use App\Models\AssessmentProtocol;
use App\Models\AssessmentVersion;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminTest extends TestCase
{
    public function test_first_admin_is_created_from_the_console(): void
    {
        $this->artisan('cognitest:create-admin', ['email' => 'Root@Example.ir', '--password' => 'S3cret-pass'])->assertSuccessful();
        $this->postJson('/api/v1/auth/login', ['email' => 'root@example.ir', 'password' => 'S3cret-pass'])
            ->assertOk()->assertJsonPath('user.platform_role', 'super_admin');
    }

    public function test_any_password_can_be_reset_from_the_console(): void
    {
        $user = User::factory()->create(['email' => 'dr@clinic.ir']);
        $user->createToken('old');
        $this->artisan('cognitest:reset-password', ['email' => 'DR@clinic.ir', '--password' => 'N3w-password'])->assertSuccessful();
        $this->postJson('/api/v1/auth/login', ['email' => 'dr@clinic.ir', 'password' => 'N3w-password'])->assertOk();
        $this->assertSame(1, $user->tokens()->count(), 'old sessions are revoked');
        $this->artisan('cognitest:reset-password', ['email' => 'nobody@x.ir'])->assertFailed();
    }

    public function test_demo_data_never_creates_a_known_admin_password_on_servers(): void
    {
        $this->system(fn () => $this->seed(DemoSeeder::class));
        $this->assertDatabaseMissing('users', ['email' => 'admin@cognitest.ir']);
        $this->assertDatabaseHas('users', ['email' => 'owner@demo.cognitest.ir']);
    }

    public function test_redeploy_keeps_plan_prices(): void
    {
        $this->system(fn () => Plan::query()->where('key', 'starter')->update(['price_irr' => 25_000_000]));
        $this->system(fn () => $this->seed(PlanSeeder::class));
        $this->assertSame(25_000_000, $this->system(fn () => Plan::query()->where('key', 'starter')->value('price_irr')));
    }

    public function test_clinic_users_cannot_reach_the_admin_api(): void
    {
        $this->actingAsClinic();
        $this->getJson('/api/v1/admin/stats')->assertStatus(403)->assertJsonPath('code', 'platform_admin_required');
    }

    public function test_admins_see_all_clinics(): void
    {
        $this->actingAsClinic();
        $this->actingAsClinic();
        Sanctum::actingAs(User::factory()->platformAdmin()->create());

        $this->getJson('/api/v1/admin/tenants')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/admin/stats')->assertOk()->assertJsonPath('tenants', 2);
        $this->getJson('/api/v1/admin/audit-logs')->assertOk()->assertJsonPath('total', 2);
    }

    public function test_clinic_search_does_not_bypass_the_status_filter(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        Tenant::factory()->create(['name' => 'Alpha', 'slug' => 'alpha-x', 'status' => 'active']);
        Tenant::factory()->create(['name' => 'Beta', 'slug' => 'alpha-y', 'status' => 'suspended']);
        $this->getJson('/api/v1/admin/tenants?q=alpha&status=suspended')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta');
    }

    public function test_admins_provision_and_suspend_clinics(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $res = $this->postJson('/api/v1/admin/tenants', [
            'name' => 'Clinic Tabriz', 'owner_email' => 'owner@tabriz.ir', 'owner_name' => 'Owner', 'plan' => 'clinic',
        ])->assertCreated();
        $id = $res->json('data.id');

        // The new owner can sign in with the one-time password shown to the admin.
        $password = $res->json('owner_temporary_password');
        $this->assertSame(12, strlen($password));
        $this->postJson('/api/v1/auth/login', ['email' => 'owner@tabriz.ir', 'password' => $password])->assertOk();

        // An existing account keeps its password; nothing is returned.
        $this->postJson('/api/v1/admin/tenants', ['name' => 'Second', 'owner_email' => 'owner@tabriz.ir', 'owner_name' => 'Owner'])
            ->assertCreated()->assertJsonPath('owner_temporary_password', null);

        $this->patchJson("/api/v1/admin/tenants/{$id}", ['status' => 'suspended'])->assertOk()->assertJsonPath('data.status', 'suspended');
    }

    public function test_new_clinic_returns_the_owner_sign_in_details(): void
    {
        config(['cognitest.clinic_web_url' => 'https://82.115.25.8']);
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $res = $this->postJson('/api/v1/admin/tenants', ['name' => 'Clinic Shiraz', 'owner_email' => 'Owner@Shiraz.ir', 'owner_name' => 'Dr Owner'])
            ->assertCreated()
            ->assertJsonPath('data.owner.email', 'owner@shiraz.ir')
            ->assertJsonPath('credentials.email', 'owner@shiraz.ir')
            ->assertJsonPath('credentials.name', 'Dr Owner')
            ->assertJsonPath('credentials.login_url', 'https://82.115.25.8/login');
        $this->assertSame($res->json('owner_temporary_password'), $res->json('credentials.password'));

        $this->getJson('/api/v1/admin/tenants')->assertJsonPath('data.0.owner.email', 'owner@shiraz.ir');
    }

    public function test_admins_issue_a_new_owner_password(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $id = $this->postJson('/api/v1/admin/tenants', ['name' => 'Clinic Rasht', 'owner_email' => 'owner@rasht.ir', 'owner_name' => 'Owner'])->json('data.id');
        $owner = User::query()->where('email', 'owner@rasht.ir')->first();
        $owner->createToken('old');

        $password = $this->postJson("/api/v1/admin/tenants/{$id}/owner/reset-password")
            ->assertOk()->assertJsonPath('credentials.email', 'owner@rasht.ir')->json('credentials.password');

        $this->assertSame(0, $owner->tokens()->count());
        $this->postJson('/api/v1/auth/login', ['email' => 'owner@rasht.ir', 'password' => $password])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.tenant.owner_password_reset', 'subject_id' => $owner->id]);
    }

    public function test_owner_password_reset_does_not_touch_platform_admins(): void
    {
        $admin = User::factory()->platformAdmin()->create(['email' => 'root@cognitest.ir']);
        Sanctum::actingAs($admin);
        $id = $this->postJson('/api/v1/admin/tenants', ['name' => 'Own clinic', 'owner_email' => 'root@cognitest.ir', 'owner_name' => 'Root'])->json('data.id');
        $this->postJson("/api/v1/admin/tenants/{$id}/owner/reset-password")->assertStatus(409)->assertJsonPath('code', 'platform_admin_protected');
    }

    public function test_versions_are_immutable_after_publishing(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $type = $this->postJson('/api/v1/admin/assessment-types', ['key' => 'go-nogo', 'name' => 'Go/No-Go', 'category' => 'attention'])->json('data.id');
        $protocol = json_decode(file_get_contents(database_path('seeders/data/demo-cpt.protocol.json')), true);
        $protocol['version'] = '2.0.0';

        $versionId = $this->postJson("/api/v1/admin/assessment-types/{$type}/versions", [
            'version' => '2.0.0', 'is_clinical' => false, 'estimated_duration_seconds' => 400,
            'protocol' => $protocol, 'scoring' => ['algorithm_version' => 'generic-cpt/1.0.0'],
        ])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');

        // Drafts are editable at the database level…
        $this->system(fn () => AssessmentProtocol::query()->where('assessment_version_id', $versionId)->first()->update(['config' => $protocol]));

        $this->postJson("/api/v1/admin/assessment-versions/{$versionId}/publish")->assertOk()->assertJsonPath('data.status', 'published');

        // …published ones are not, even with raw SQL.
        try {
            DB::transaction(fn () => DB::update('UPDATE assessment_protocols SET config = ? WHERE assessment_version_id = ?', ['{}', $versionId]));
            $this->fail('published protocol must be immutable');
        } catch (QueryException $e) {
            $this->assertStringContainsString('immutable', $e->getMessage());
        }
        $this->expectExceptionMessage('immutable');
        $this->system(fn () => AssessmentVersion::find($versionId)->update(['estimated_duration_seconds' => 1]));
    }

    public function test_audit_and_raw_event_tables_are_append_only(): void
    {
        $this->actingAsClinic(); // writes tenant.created audit entries
        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('append-only');
        DB::update('UPDATE audit_logs SET action = ?', ['tampered']);
    }
}
