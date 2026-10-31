<?php

namespace Tests\Feature;

use App\Domain\Norms\NormScorer;
use App\Domain\Tenancy\TenantRole;
use App\Models\AssessmentVersion;
use App\Models\NormEntry;
use App\Models\NormSet;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NormsTest extends TestCase
{
    private const CSV = <<<'CSV'
        scope,metric_key,sex,age_min,age_max,mean,sd,n,direction
        overall,rt_mean,all,6,8,650.5,110,80,
        overall,rt_mean,all,9,12,520,90,95,lower_better
        overall,hit_rate,female,۶,۸,0.88,0.06,40,
        CSV;

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
    }

    private function upload(string $csv, string $version = '1.0'): TestResponse
    {
        $id = AssessmentVersion::query()->where('version', '1.1.0')->value('id');

        return $this->postJson("/api/v1/admin/assessment-versions/{$id}/norm-sets", [
            'name' => 'هنجار مقدماتی', 'version' => $version, 'provisional' => true, 'source' => 'Pilot, Tehran 2026', 'csv' => $csv,
        ]);
    }

    public function test_admins_upload_review_and_publish_norm_sets(): void
    {
        $this->admin();
        $id = $this->upload(self::CSV)->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.entries_count', 3)
            ->assertJsonPath('data.coverage.age_min_years', 6)
            ->assertJsonPath('data.coverage.min_n', 40)
            ->json('data.id');

        $entries = $this->getJson("/api/v1/admin/norm-sets/{$id}")->assertOk()->json('data.entries');
        $hit = collect($entries)->firstWhere('metric_key', 'hit_rate');
        $this->assertSame([6, 'female', 'higher_better'], [$hit['age_min_years'], $hit['sex'], $hit['direction']]); // Persian digits, default direction

        $this->postJson("/api/v1/admin/norm-sets/{$id}/publish")->assertOk()->assertJsonPath('data.status', 'published');
        // A newer set replaces it for new reports.
        $next = $this->upload(self::CSV, '1.1')->assertCreated()->json('data.id');
        $this->postJson("/api/v1/admin/norm-sets/{$next}/publish")->assertOk();
        $this->assertSame('retired', NormSet::find($id)->status);

        $this->deleteJson("/api/v1/admin/norm-sets/{$next}")->assertStatus(409);
        $this->upload(self::CSV, '1.1')->assertStatus(409)->assertJsonPath('code', 'version_exists');
        $this->expectExceptionMessage('immutable');
        NormSet::find($next)->update(['name' => 'changed']);
    }

    public function test_csv_errors_name_the_line(): void
    {
        $this->admin();
        $this->upload("metric,mean\nrt_mean,1")->assertStatus(422)->assertJsonPath('errors.csv.0', fn ($m) => str_contains($m, 'سطر اول'));

        $errors = $this->upload(<<<'CSV'
            scope,metric_key,sex,age_min,age_max,mean,sd,n,direction
            overall,rt_maen,all,6,8,650,110,80,
            overall,rt_mean,all,9,6,650,0,80,
            overall,rt_mean,all,6,8,650,110,80,
            overall,rt_mean,all,8,10,650,110,80,
            CSV)->assertStatus(422)->json('errors.csv');

        $this->assertStringContainsString('سطر 2', $errors[0]);
        $this->assertStringContainsString('rt_maen', $errors[0]);
        $this->assertStringContainsString('سطر 3', $errors[1]);
        $this->assertStringContainsString('sd', $errors[1]);
        $this->assertStringContainsString('هم‌پوشانی', $errors[2]); // 6–8 and 8–10 overlap
        $this->assertSame(0, NormSet::count());
    }

    public function test_clinics_cannot_manage_norms(): void
    {
        $this->actingAsClinic(TenantRole::Owner);
        $this->upload(self::CSV)->assertForbidden();
    }

    public function test_standard_scores_are_oriented_so_higher_is_better(): void
    {
        $rt = new NormEntry(['mean' => 500, 'sd' => 100, 'n' => 50, 'direction' => 'lower_better', 'age_min_years' => 6, 'age_max_years' => 8, 'sex' => 'all']);
        $this->assertSame(['z' => 1.0, 'standard_score' => 115, 'band' => 'high'], array_intersect_key(NormScorer::compare(400, $rt), array_flip(['z', 'standard_score', 'band'])));
        $this->assertSame(84.1, NormScorer::compare(400, $rt)['percentile']);
        $this->assertSame('very_low', NormScorer::compare(800, $rt)['band']); // z = −3 → 55
        $this->assertSame(0.1, NormScorer::compare(2000, $rt)['percentile']); // clamped

        $hits = new NormEntry(['mean' => 0.9, 'sd' => 0.05, 'n' => 50, 'direction' => 'higher_better', 'age_min_years' => 6, 'age_max_years' => 8, 'sex' => 'all']);
        $this->assertSame(70, NormScorer::compare(0.8, $hits)['standard_score']);
        $this->assertSame('low', NormScorer::compare(0.8, $hits)['band']);
        $this->assertSame(50.0, round(NormScorer::normalCdf(0) * 100, 1));
    }

    public function test_research_consent_is_recorded_and_revocable(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $id = $this->postJson('/api/v1/patients', ['first_name' => 'سارا', 'birth_date' => '2018-02-01', 'research_consent' => true, 'guardian' => ['full_name' => 'مریم احمدی', 'relation' => 'mother']])
            ->assertCreated()->assertJsonPath('data.research_consent', true)->json('data.id');
        $this->system(fn () => $this->assertDatabaseHas('consents', ['patient_id' => $id, 'consent_type' => 'research', 'accepted_by_name' => 'مریم احمدی', 'revoked_at' => null]));

        $this->patchJson("/api/v1/patients/{$id}", ['research_consent' => false])->assertOk()->assertJsonPath('data.research_consent', false);
        $this->getJson("/api/v1/patients/{$id}")->assertJsonPath('data.research_consent', false);
        $this->system(fn () => $this->assertDatabaseMissing('consents', ['patient_id' => $id, 'consent_type' => 'research', 'revoked_at' => null]));
    }
}
