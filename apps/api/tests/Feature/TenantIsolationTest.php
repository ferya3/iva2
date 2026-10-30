<?php

namespace Tests\Feature;

use App\Domain\Tenancy\TenantRole;
use App\Models\Patient;
use App\Models\Tenant;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Multi-tenant isolation: application layer (scope + middleware) and
 * database layer (PostgreSQL Row-Level Security).
 */
class TenantIsolationTest extends TestCase
{
    private function patientOf(Tenant $tenant, string $code = 'P-1'): Patient
    {
        return $this->inTenant($tenant, fn () => Patient::create(['patient_code' => $code]));
    }

    public function test_tenant_header_is_required(): void
    {
        $this->actingAsClinic();
        $this->withHeader('X-Tenant-ID', '')->getJson('/api/v1/patients')->assertStatus(400)->assertJsonPath('code', 'tenant_required');
    }

    public function test_non_members_are_rejected(): void
    {
        $this->actingAsClinic();
        $other = Tenant::factory()->create();
        $this->withHeader('X-Tenant-ID', $other->id)->getJson('/api/v1/patients')->assertStatus(403)->assertJsonPath('code', 'tenant_forbidden');
    }

    public function test_suspended_clinics_are_locked(): void
    {
        [$tenant] = $this->actingAsClinic();
        $tenant->update(['status' => 'suspended']);
        $this->getJson('/api/v1/patients')->assertStatus(403)->assertJsonPath('code', 'tenant_suspended');
    }

    public function test_records_of_another_clinic_are_invisible(): void
    {
        [$mine] = $this->actingAsClinic();
        $other = Tenant::factory()->create();
        $foreign = $this->patientOf($other, 'P-FOREIGN');
        $this->patientOf($mine, 'P-MINE');

        $this->getJson('/api/v1/patients')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.patient_code', 'P-MINE');
        $this->getJson("/api/v1/patients/{$foreign->id}")->assertNotFound()->assertJsonPath('code', 'not_found');
        $this->patchJson("/api/v1/patients/{$foreign->id}", ['first_name' => 'x'])->assertNotFound();
        $this->getJson("/api/v1/patients/{$foreign->id}/sessions")->assertNotFound();
    }

    public function test_models_refuse_cross_tenant_writes(): void
    {
        [$mine] = $this->actingAsClinic();
        $other = Tenant::factory()->create();
        $this->expectException(\LogicException::class);
        $this->inTenant($mine, fn () => Patient::create(['patient_code' => 'X', 'tenant_id' => $other->id]));
    }

    public function test_permissions_follow_the_role(): void
    {
        $this->actingAsClinic(TenantRole::Assistant);
        $this->getJson('/api/v1/patients')->assertOk();
        $this->getJson('/api/v1/tenant/members')->assertStatus(403)->assertJsonPath('code', 'permission_denied');
        $this->patchJson('/api/v1/tenant', ['name' => 'x'])->assertStatus(403);
    }

    public function test_row_level_security_isolates_tenants_in_the_database(): void
    {
        $exists = DB::selectOne("SELECT 1 AS ok FROM pg_roles WHERE rolname = 'cognitest_app'");
        if (! $exists) {
            $this->markTestSkipped('cognitest_app role not present (see infrastructure/postgres/init.sql).');
        }
        $a = Tenant::factory()->create();
        $b = Tenant::factory()->create();
        $this->patientOf($a, 'A-1');
        $this->patientOf($b, 'B-1');

        DB::statement('SET ROLE cognitest_app');
        try {
            DB::select("SELECT set_config('app.bypass_rls', 'off', false), set_config('app.tenant_id', '', false)");
            $this->assertSame(0, DB::selectOne('SELECT count(*) AS n FROM patients')->n, 'no context → nothing visible');

            DB::select("SELECT set_config('app.tenant_id', ?, false)", [$a->id]);
            $codes = array_column(DB::select('SELECT patient_code FROM patients'), 'patient_code');
            $this->assertSame(['A-1'], $codes, 'raw SQL only sees the current tenant');

            try {
                // Savepoint so the expected failure does not abort the test transaction.
                DB::transaction(fn () => DB::insert(
                    'INSERT INTO patients (id, tenant_id, patient_code, pseudonym, created_at, updated_at) VALUES (gen_random_uuid(), ?, ?, gen_random_uuid(), now(), now())',
                    [$b->id, 'SMUGGLED'],
                ));
                $this->fail('cross-tenant insert must be rejected');
            } catch (QueryException $e) {
                $this->assertStringContainsString('row-level security', $e->getMessage());
            }
        } finally {
            DB::statement('RESET ROLE');
        }
    }
}
