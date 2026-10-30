<?php

namespace Tests\Feature;

use App\Models\AssessmentProtocol;
use App\Models\AssessmentVersion;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminTest extends TestCase
{
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

    public function test_admins_provision_and_suspend_clinics(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $id = $this->postJson('/api/v1/admin/tenants', [
            'name' => 'Clinic Tabriz', 'owner_email' => 'owner@tabriz.ir', 'owner_name' => 'Owner', 'plan' => 'clinic',
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/v1/admin/tenants/{$id}", ['status' => 'suspended'])->assertOk()->assertJsonPath('data.status', 'suspended');
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
