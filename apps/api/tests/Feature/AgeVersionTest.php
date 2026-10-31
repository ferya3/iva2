<?php

namespace Tests\Feature;

use App\Domain\Tenancy\TenantRole;
use App\Models\AssessmentType;
use App\Models\AssessmentVersion;
use App\Models\User;
use Database\Seeders\AssessmentCatalogSeeder;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AgeVersionTest extends TestCase
{
    private function patient(?int $ageYears): string
    {
        $birth = $ageYears === null ? null : now()->subYears($ageYears)->subMonths(3)->toDateString();

        return $this->postJson('/api/v1/patients', ['birth_date' => $birth])->assertCreated()->json('data.id');
    }

    private function typeId(): string
    {
        return AssessmentType::query()->where('key', 'demo-cpt')->value('id');
    }

    public function test_the_catalogue_has_a_child_and_a_standard_version(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $versions = collect($this->getJson('/api/v1/assessment-types')->assertOk()->json('data.0.versions'))->keyBy('version');

        $this->assertSame([6, 8], [$versions['1.1.0-child']['min_age_years'], $versions['1.1.0-child']['max_age_years']]);
        $this->assertSame('۶–۸ سال', $versions['1.1.0-child']['age_range_label']);
        $this->assertSame([9, null], [$versions['1.1.0']['min_age_years'], $versions['1.1.0']['max_age_years']]);
    }

    public function test_the_version_is_chosen_from_the_patients_age(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        foreach ([6 => '1.1.0-child', 8 => '1.1.0-child', 9 => '1.1.0', 25 => '1.1.0'] as $age => $expected) {
            $this->postJson('/api/v1/sessions', ['patient_id' => $this->patient($age), 'assessment_type_id' => $this->typeId()])
                ->assertCreated()
                ->assertJsonPath('data.assessment.version', $expected);
        }
    }

    public function test_an_unknown_or_unsupported_age_is_explained(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $this->postJson('/api/v1/sessions', ['patient_id' => $this->patient(null), 'assessment_type_id' => $this->typeId()])
            ->assertStatus(422)->assertJsonPath('code', 'age_required');
        $this->postJson('/api/v1/sessions', ['patient_id' => $this->patient(4), 'assessment_type_id' => $this->typeId()])
            ->assertStatus(422)->assertJsonPath('code', 'no_version_for_age');
    }

    public function test_a_version_outside_the_age_range_needs_an_explicit_override(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $child = AssessmentVersion::query()->where('version', '1.1.0-child')->value('id');
        $adult = $this->patient(30);

        $this->postJson('/api/v1/sessions', ['patient_id' => $adult, 'assessment_version_id' => $child])
            ->assertStatus(422)->assertJsonPath('code', 'age_out_of_range')->assertJsonPath('details.max_age_years', 8);

        $id = $this->postJson('/api/v1/sessions', ['patient_id' => $adult, 'assessment_version_id' => $child, 'allow_age_override' => true])
            ->assertCreated()->assertJsonPath('data.assessment.version', '1.1.0-child')->json('data.id');
        $this->system(fn () => $this->assertDatabaseHas('audit_logs', ['action' => 'session.created', 'subject_id' => $id, 'metadata->age_override' => true]));
    }

    public function test_admins_change_the_age_range_of_a_published_version(): void
    {
        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $child = AssessmentVersion::query()->where('version', '1.1.0-child')->firstOrFail();

        $this->patchJson("/api/v1/admin/assessment-versions/{$child->id}", ['min_age_years' => 5, 'max_age_years' => 8, 'audience_label' => 'کودکان ۵ تا ۸ سال'])
            ->assertOk()->assertJsonPath('data.min_age_years', 5)->assertJsonPath('data.status', 'published');
        $this->patchJson("/api/v1/admin/assessment-versions/{$child->id}", ['min_age_years' => 9, 'max_age_years' => 8])
            ->assertStatus(422)->assertJsonValidationErrors('max_age_years');

        // Re-running the seeder (every update) keeps the administrator's choice.
        $this->seed(AssessmentCatalogSeeder::class);
        $this->assertSame(5, $child->fresh()->min_age_years);
        $this->assertSame(2, AssessmentVersion::query()->published()->count());
    }
}
