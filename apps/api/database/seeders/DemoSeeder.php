<?php

namespace Database\Seeders;

use App\Domain\Events\EventIngestor;
use App\Domain\Scoring\ScoreSession;
use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\PlatformRole;
use App\Domain\Tenancy\TenantContext;
use App\Domain\Tenancy\TenantProvisioner;
use App\Domain\Tenancy\TenantRole;
use App\Models\AssessmentVersion;
use App\Models\Patient;
use App\Models\PatientProfile;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Throwable;

/**
 * Local/demo data. Credentials (password "password"):
 *   admin@cognitest.ir      platform super-admin (admin-web) — local environment only
 *   owner@demo.cognitest.ir clinic owner (clinic-web)
 *   clinician@demo.cognitest.ir
 */
class DemoSeeder extends Seeder
{
    public function run(TenantContext $context, TenantProvisioner $provisioner): void
    {
        $context->runAsSystem(function () use ($context, $provisioner) {
            // A platform admin with a known password only on developer machines;
            // servers get theirs from `cognitest:create-admin` (scripts/install.sh).
            if (app()->environment('local')) {
                User::query()->firstOrCreate(['email' => 'admin@cognitest.ir'], [
                    'name' => 'مدیر سامانه', 'password' => 'password', 'platform_role' => PlatformRole::SuperAdmin,
                ]);
            }
            if (Tenant::query()->where('slug', 'demo-clinic')->exists()) {
                return;
            }

            $owner = User::create(['name' => 'دکتر سارا احمدی', 'email' => 'owner@demo.cognitest.ir', 'password' => 'password']);
            $clinician = User::create(['name' => 'دکتر علی رضایی', 'email' => 'clinician@demo.cognitest.ir', 'password' => 'password']);
            $tenant = $provisioner->provision(['name' => 'کلینیک روان‌شناسی آرامش', 'slug' => 'demo-clinic', 'city' => 'تهران'], $owner, 'professional', 365);
            $tenant->update(['status' => 'active']);
            TenantUser::create(['tenant_id' => $tenant->id, 'user_id' => $clinician->id, 'role' => TenantRole::Clinician, 'status' => 'active']);

            $context->runAs($tenant, fn () => $this->seedClinic($tenant, $clinician));
        });
    }

    private function seedClinic(Tenant $tenant, User $clinician): void
    {
        Subscription::query()->update(['status' => 'active']);
        $names = [['مریم', 'کریمی'], ['امیرحسین', 'نوری'], ['زهرا', 'محمدی'], ['آرش', 'صادقی'], ['نیلوفر', 'حسینی'], ['پارسا', 'جعفری']];
        $patients = [];
        foreach ($names as $i => [$first, $last]) {
            $patient = Patient::create(['patient_code' => 'P-'.(1024 + $i), 'created_by' => $clinician->id]);
            PatientProfile::create([
                'patient_id' => $patient->id,
                'first_name' => $first,
                'last_name' => $last,
                'birth_date' => now()->subYears(8 + $i * 3)->subDays($i * 41)->toDateString(),
                'sex' => $i % 2 ? 'male' : 'female',
                'handedness' => $i === 3 ? 'left' : 'right',
            ]);
            $patients[] = $patient;
        }

        $version = AssessmentVersion::query()->published()->firstOrFail();
        foreach ([1, 2, 3] as $i) {
            TestSession::create(['patient_id' => $patients[$i]->id, 'assessment_version_id' => $version->id, 'created_by' => $clinician->id]);
        }
        $this->seedCompletedSession($patients[0], $version, $clinician);
    }

    /** Runs the real ingest + scoring pipeline on the generated demo event stream. */
    private function seedCompletedSession(Patient $patient, AssessmentVersion $version, User $clinician): void
    {
        $states = app(SessionStateMachine::class);
        $session = TestSession::create(['patient_id' => $patient->id, 'assessment_version_id' => $version->id, 'created_by' => $clinician->id]);
        $states->path($session, [SessionStatus::Invited, SessionStatus::DeviceCheck, SessionStatus::Calibration, SessionStatus::Ready], 'system');
        $states->transition($session, SessionStatus::Running, 'system', null, 'demo', ['seed' => 4242, 'started_at' => now()->subMinutes(30)]);

        $events = json_decode(file_get_contents(__DIR__.'/data/demo-session.events.json'), true);
        foreach (array_chunk($events, 200) as $chunk) {
            app(EventIngestor::class)->ingest($session, [
                'session_id' => $session->id, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => $chunk,
            ]);
        }
        $states->path($session, [SessionStatus::Uploading, SessionStatus::Completed], 'system', null, [
            'expected_final_sequence' => count($events), 'completed_at' => now()->subMinutes(22),
        ]);

        try {
            app(ScoreSession::class)->run($session->refresh());
        } catch (Throwable $e) {
            $this->command?->warn('Demo session not scored (build packages/scoring-engine first): '.$e->getMessage());
        }
    }
}
