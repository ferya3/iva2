<?php

namespace Tests\Feature;

use App\Models\PatientProfile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PatientTest extends TestCase
{
    public function test_creates_a_patient_with_encrypted_identity_data(): void
    {
        $this->actingAsClinic();

        $res = $this->postJson('/api/v1/patients', [
            'first_name' => 'مریم',
            'last_name' => 'کریمی',
            'national_id' => '۰۰۱۲۳۴۵۶۷۸', // Persian digits are normalised
            'birth_date' => '2015-03-21',
            'sex' => 'female',
            'phone' => '09121234567',
            'guardian' => ['full_name' => 'زهره کریمی', 'relation' => 'mother'],
            'consent' => ['accepted_by_name' => 'زهره کریمی', 'version' => '1.0'],
        ])->assertCreated()->assertJsonPath('data.first_name', 'مریم');

        $id = $res->json('data.id');
        $this->assertMatchesRegularExpression('/^P-\d{5}$/', $res->json('data.patient_code'));

        $raw = DB::table('patient_profiles')->where('patient_id', $id)->first();
        $this->assertStringNotContainsString('0012345678', $raw->national_id);
        $this->assertSame(PatientProfile::blindIndex('0012345678'), $raw->national_id_hash);

        $this->getJson("/api/v1/patients/{$id}")->assertOk()->assertJsonPath('data.national_id', '0012345678');
        $this->getJson('/api/v1/patients')->assertOk()->assertJsonMissingPath('data.0.national_id');
        $this->assertDatabaseHas('audit_logs', ['action' => 'patient.viewed', 'subject_id' => $id]);
    }

    public function test_searches_by_name_code_and_national_id(): void
    {
        $this->actingAsClinic();
        $this->postJson('/api/v1/patients', ['patient_code' => 'P-1', 'last_name' => 'کریمی', 'national_id' => '0012345678'])->assertCreated();
        $this->postJson('/api/v1/patients', ['patient_code' => 'P-2', 'last_name' => 'نوری'])->assertCreated();

        $this->getJson('/api/v1/patients?q=کریم')->assertJsonCount(1, 'data')->assertJsonPath('data.0.patient_code', 'P-1');
        $this->getJson('/api/v1/patients?q=0012345678')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/patients?q=P-2')->assertJsonCount(1, 'data');
    }

    public function test_validates_iranian_formats_and_unique_codes(): void
    {
        $this->actingAsClinic();
        $this->postJson('/api/v1/patients', ['patient_code' => 'P-1'])->assertCreated();
        $this->postJson('/api/v1/patients', ['patient_code' => 'P-1', 'national_id' => '123', 'phone' => '021555'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['patient_code', 'national_id', 'phone']);
    }

    public function test_validation_messages_are_readable_text_not_translation_keys(): void
    {
        config(['app.locale' => 'fa']); // as in production (Docker sets APP_LOCALE=fa)
        app()->setLocale('fa');
        $this->actingAsClinic();
        $message = $this->postJson('/api/v1/patients', ['birth_date' => 'not-a-date'])->assertStatus(422)->json('errors.birth_date.0');
        $this->assertStringNotContainsString('validation.', $message);
    }
}
