<?php

namespace Tests\Feature;

use App\Domain\Scoring\ScoringEngine;
use App\Domain\Tenancy\TenantRole;
use App\Models\AssessmentVersion;
use App\Models\TestSession;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\FakeScoringEngine;
use Tests\TestCase;

/**
 * End-to-end clinic + player workflow:
 * patient → session → invite → join → device check → calibration → start
 * → event batches → completion → scoring → results → report → PDF.
 */
class SessionFlowTest extends TestCase
{
    private FakeScoringEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['cognitest.reports.disk' => 'local']);
        $this->engine = new FakeScoringEngine;
        $this->app->instance(ScoringEngine::class, $this->engine);
    }

    private function calibration(float $hz = 60.0, string $verdict = 'pass'): array
    {
        return [
            'display' => ['samples' => 119, 'refresh_rate_hz' => $hz, 'frame_interval_mean_ms' => 1000 / $hz, 'frame_interval_sd_ms' => 0.21, 'frame_interval_p99_ms' => 17.1, 'dropped_frame_ratio' => 0],
            'input' => ['samples' => 5, 'dispatch_latency_mean_ms' => 1.2, 'dispatch_latency_p95_ms' => 2.4],
            'audio' => ['available' => true, 'sample_rate' => 48000, 'base_latency_ms' => 10, 'output_latency_ms' => 32],
            'verdict' => $verdict,
            'reasons' => [],
        ];
    }

    private function device(): array
    {
        return [
            'os' => 'Windows', 'os_version' => '10.0.22631', 'app_version' => '0.1.0', 'engine_version' => '1.0.0',
            'cpu_model' => 'Intel Core i5', 'cpu_cores' => 8, 'memory_gb' => 16,
            'screen' => ['width' => 1920, 'height' => 1080, 'scale_factor' => 1, 'color_depth' => 24],
            'gpu' => null, 'audio_output' => 'Speakers',
        ];
    }

    /** @return array{string, string} session id + player token */
    private function createAndJoin(): array
    {
        $patient = $this->postJson('/api/v1/patients', ['first_name' => 'آرش', 'birth_date' => '2014-05-01'])->assertCreated()->json('data.id');
        $version = AssessmentVersion::query()->published()->firstOrFail();
        $session = $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])
            ->assertCreated()->assertJsonPath('data.status', 'CREATED')->json('data.id');

        $invite = $this->postJson("/api/v1/sessions/{$session}/invite")->assertCreated();
        $this->assertMatchesRegularExpression('/^[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{3}$/', $invite->json('code'));
        $this->assertStringStartsWith('cognitest://join?code=', $invite->json('deep_link'));

        // Codes are case- and dash-insensitive (typed by participants).
        $typed = strtolower(str_replace('-', ' ', $invite->json('code')));
        $join = $this->postJson('/api/v1/player/join', ['code' => $typed, 'device_id' => 'win-001'])->assertOk();
        $this->assertSame('demo-cpt', $join->json('session.assessment.protocol.key'));
        $this->assertSame(64, strlen($join->json('session.assessment.protocol_sha256')));

        return [$session, $join->json('token')];
    }

    public function test_the_complete_workflow(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        [$session, $token] = $this->createAndJoin();
        $player = fn () => $this->withToken($token);

        $player()->postJson("/api/v1/sessions/{$session}/device-check", $this->device())->assertOk()->assertJsonPath('status', 'DEVICE_CHECK');
        $player()->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration())->assertOk()
            ->assertJsonPath('verdict', 'pass')->assertJsonPath('status', 'READY');
        $start = $player()->postJson("/api/v1/sessions/{$session}/start")->assertOk()->assertJsonPath('status', 'RUNNING');
        $this->assertIsInt($start->json('seed'));

        $events = $this->demoEvents();
        $chunks = array_chunk($events, 250);
        // Upload all but the last batch, then announce completion: not done yet.
        foreach (array_slice($chunks, 0, -1) as $chunk) {
            $player()->postJson("/api/v1/sessions/{$session}/events/batch", ['session_id' => $session, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => $chunk])->assertCreated();
        }
        $player()->postJson("/api/v1/sessions/{$session}/complete", ['final_sequence' => count($events)])
            ->assertStatus(202)->assertJsonPath('status', 'UPLOADING')->assertJsonPath('missing_from', 501);

        // The outbox drains → the session completes and is scored automatically.
        $last = end($chunks);
        $player()->postJson("/api/v1/sessions/{$session}/events/batch", ['session_id' => $session, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => $last])->assertCreated();

        $this->assertCount(1, $this->engine->calls);
        $this->assertSame(count($events), $this->engine->calls[0]['events']);
        $this->assertSame(['practice'], $this->engine->calls[0]['config']['practiceBlockKeys']);

        $this->getJson("/api/v1/sessions/{$session}")->assertOk()
            ->assertJsonPath('data.status', 'VALIDATED')
            ->assertJsonPath('data.validity_status', 'valid')
            ->assertJsonPath('data.calibration.verdict', 'pass');

        // Player credentials are revoked once the run is complete.
        $player()->getJson('/api/v1/player/session')->assertStatus(401);

        $this->getJson("/api/v1/sessions/{$session}/results")->assertOk()
            ->assertJsonPath('algorithm_version', 'fake/1.0.0')
            ->assertJsonFragment(['key' => 'rt_mean', 'value' => 412.68, 'scope' => 'overall']);

        $report = $this->postJson("/api/v1/sessions/{$session}/reports")->assertCreated()
            ->assertJsonPath('data.report_version', 1)
            ->assertJsonPath('data.content.patient.age_years', 12);
        $this->assertSame('شاخص‌های کلی', $report->json('data.content.sections.0.title'));
        $this->getJson("/api/v1/sessions/{$session}")->assertJsonPath('data.status', 'REPORTED');

        $reportId = $report->json('data.id');
        $download = $this->get("/api/v1/reports/{$reportId}/download")->assertOk();
        $this->assertStringStartsWith('%PDF', $download->streamedContent());
        $this->assertDatabaseHas('report_access_logs', ['report_id' => $reportId, 'action' => 'download']);

        // A second report is a new immutable version. Reports stay Persian
        // even when the server runs with another APP_LOCALE (Docker has no .env).
        app()->setLocale('en');
        $second = $this->postJson("/api/v1/sessions/{$session}/reports")->assertCreated()->assertJsonPath('data.report_version', 2);
        $this->assertSame('شاخص‌های کلی', $second->json('data.content.sections.0.title'));
        $this->assertSame(__('metrics.disclaimers', [], 'fa'), array_slice($second->json('data.content.disclaimers'), -count(__('metrics.disclaimers', [], 'fa'))));
        $this->getJson("/api/v1/sessions/{$session}/report")->assertJsonPath('data.report_version', 2);
    }

    public function test_an_invalid_run_ends_in_invalid(): void
    {
        $this->app->instance(ScoringEngine::class, new FakeScoringEngine('invalid'));
        [$tenant] = $this->actingAsClinic();
        [$session, $token] = $this->createAndJoin();
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/device-check", $this->device());
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration());
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/start");
        $events = $this->eventFixture()['events'];
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/events/batch", ['session_id' => $session, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => $events]);
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/complete", ['final_sequence' => 5])->assertOk()->assertJsonPath('status', 'COMPLETED');

        $this->getJson("/api/v1/sessions/{$session}")->assertJsonPath('data.status', 'INVALID');
        $this->postJson("/api/v1/sessions/{$session}/reports")->assertStatus(409)->assertJsonPath('code', 'session_not_reportable');
    }

    public function test_a_failed_calibration_blocks_the_start(): void
    {
        $this->actingAsClinic();
        [$session, $token] = $this->createAndJoin();
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/device-check", $this->device());
        // Client claims "pass" on a 30 Hz display — the server re-checks.
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration(30.0))
            ->assertOk()->assertJsonPath('verdict', 'fail')->assertJsonPath('status', 'CALIBRATION');
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/start")->assertStatus(409)->assertJsonPath('code', 'invalid_session_transition');

        // Retry on a better display works.
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/device-check", $this->device())->assertJsonPath('status', 'DEVICE_CHECK');
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration(144.0))->assertJsonPath('status', 'READY');
    }

    public function test_invite_codes_cannot_be_reused_after_the_start(): void
    {
        $this->actingAsClinic();
        $patient = $this->postJson('/api/v1/patients', [])->json('data.id');
        $version = AssessmentVersion::query()->published()->first();
        $session = $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])->json('data.id');
        $code = $this->postJson("/api/v1/sessions/{$session}/invite")->json('code');
        $token = $this->postJson('/api/v1/player/join', ['code' => $code, 'device_id' => 'a'])->json('token');
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/device-check", $this->device());
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration());
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/start")->assertOk();

        $this->postJson('/api/v1/player/join', ['code' => $code, 'device_id' => 'b'])->assertStatus(422)->assertJsonPath('code', 'invalid_invite');
        $this->postJson('/api/v1/player/join', ['code' => 'AAA-BBB-CCC', 'device_id' => 'b'])->assertStatus(422);
    }

    public function test_a_run_started_offline_reports_its_seed(): void
    {
        [$tenant] = $this->actingAsClinic();
        [$session, $token] = $this->createAndJoin();
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/device-check", $this->device());
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration());
        $startedAt = now()->subMinutes(20)->toIso8601String();

        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/start", ['offline_seed' => 123456, 'offline_started_at' => $startedAt])
            ->assertOk()->assertJsonPath('seed', 123456);

        $this->getJson("/api/v1/sessions/{$session}")->assertJsonPath('data.started_at', $startedAt)
            ->assertJsonFragment(['to' => 'RUNNING', 'reason' => 'offline start']);
        $this->withToken($token)->postJson("/api/v1/sessions/{$session}/start", ['offline_seed' => 1])->assertStatus(422);
    }

    public function test_expired_invites_are_swept(): void
    {
        [$tenant] = $this->actingAsClinic();
        $patient = $this->postJson('/api/v1/patients', [])->json('data.id');
        $version = AssessmentVersion::query()->published()->first();
        $session = $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])->json('data.id');
        $this->postJson("/api/v1/sessions/{$session}/invite")->assertCreated();

        $this->travel(73)->hours();
        $this->artisan('sessions:expire-invites')->assertSuccessful();
        $this->assertSame('EXPIRED', $this->inTenant($tenant, fn () => TestSession::find($session)->status->value));
    }

    public function test_session_creation_respects_the_plan_quota(): void
    {
        $this->actingAsClinic(TenantRole::Owner, 'starter');
        $patient = $this->postJson('/api/v1/patients', [])->json('data.id');
        $version = AssessmentVersion::query()->published()->first();
        for ($i = 0; $i < 30; $i++) {
            $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])->assertCreated();
        }
        $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])
            ->assertStatus(402)->assertJsonPath('code', 'quota_exceeded');
    }

    public function test_a_clinician_cannot_cancel_a_running_session(): void
    {
        $this->actingAsClinic();
        [$session, $token] = $this->createAndJoin();
        $this->postJson("/api/v1/sessions/{$session}/cancel", ['reason' => 'patient left'])->assertOk()->assertJsonPath('data.status', 'CANCELLED');
        $this->withToken($token)->getJson('/api/v1/player/session')->assertStatus(401);
    }
}
