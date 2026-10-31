<?php

namespace Tests\Feature;

use App\Domain\Scoring\ScoringEngine;
use App\Domain\Tenancy\TenantRole;
use App\Models\NormSet;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
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
    private function createAndJoin(array $patient = ['first_name' => 'آرش', 'birth_date' => '2014-05-01']): array
    {
        $patient = $this->postJson('/api/v1/patients', $patient)->assertCreated()->json('data.id');
        $version = $this->demoVersion();
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
        $this->assertContains(__('metrics.disclaimers', [], 'fa')[0], $second->json('data.content.disclaimers'));
        $this->assertContains(__('metrics.raw_scores', [], 'fa'), $second->json('data.content.disclaimers'));
        $this->getJson("/api/v1/sessions/{$session}/report")->assertJsonPath('data.report_version', 2);
    }

    /** Device check → calibration → full event upload; the fake engine scores it as valid. */
    private function runToValidated(string $session, string $token): string
    {
        $player = fn () => $this->withToken($token);
        $player()->postJson("/api/v1/sessions/{$session}/device-check", $this->device())->assertOk();
        $player()->postJson("/api/v1/sessions/{$session}/calibration", $this->calibration())->assertOk();
        $player()->postJson("/api/v1/sessions/{$session}/start")->assertOk();
        $events = $this->demoEvents();
        foreach (array_chunk($events, 250) as $chunk) {
            $player()->postJson("/api/v1/sessions/{$session}/events/batch", ['session_id' => $session, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => $chunk])->assertCreated();
        }
        $player()->postJson("/api/v1/sessions/{$session}/complete", ['final_sequence' => count($events)])->assertOk();

        return $session;
    }

    public function test_only_consented_valid_sessions_are_exported_for_norm_studies(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $this->runToValidated(...$this->createAndJoin(['first_name' => 'سارا', 'last_name' => 'محمدی', 'birth_date' => '2016-03-10', 'sex' => 'female', 'research_consent' => true]));
        $this->runToValidated(...$this->createAndJoin(['first_name' => 'بدون رضایت', 'birth_date' => '2016-03-10', 'sex' => 'male']));

        Sanctum::actingAs(User::factory()->platformAdmin()->create());
        $this->withHeaders(['X-Tenant-ID' => '']);
        $version = $this->demoVersion()->id;
        $this->getJson("/api/v1/admin/assessment-versions/{$version}/research-summary")->assertOk()
            ->assertJsonPath('data.total_sessions', 2)
            ->assertJsonPath('data.eligible_sessions', 1)
            ->assertJsonPath('data.by_age.0.female', 1);

        // As the production runtime role (subject to RLS): the streamed body
        // must still see every clinic.
        DB::statement('SET ROLE cognitest_app');
        try {
            $csv = $this->get("/api/v1/admin/assessment-versions/{$version}/research-export")->assertOk()->streamedContent();
        } finally {
            DB::statement('RESET ROLE');
        }
        $lines = array_map('str_getcsv', array_filter(explode("\n", $csv)));
        $this->assertCount(2, $lines); // header + the consented session
        $row = array_combine($lines[0], $lines[1]);
        $this->assertSame(['1', 'female', '1.1.0'], [$row['attempt'], $row['sex'], $row['assessment_version']]);
        $this->assertSame('412.68', $row['overall.rt_mean']);
        $this->assertGreaterThan(100, (int) $row['age_months']);
        $this->assertStringNotContainsString('سارا', $csv);
        $this->assertStringNotContainsString('محمدی', $csv);
    }

    public function test_results_and_reports_compare_with_published_age_norms(): void
    {
        $this->actingAsClinic(TenantRole::Clinician);
        $session = $this->runToValidated(...$this->createAndJoin()); // 12-year-old, sex unknown

        // Without published norms: raw scores only.
        $this->getJson("/api/v1/sessions/{$session}/results")->assertOk()->assertJsonPath('norms', null);

        $this->system(function () {
            $set = NormSet::create([
                'assessment_version_id' => $this->demoVersion()->id, 'name' => 'هنجار آزمایشی تهران', 'version' => '0.1',
                'status' => 'published', 'published_at' => now(), 'provisional' => true,
            ]);
            $band = ['age_min_years' => 10, 'age_max_years' => 14, 'scope' => 'overall'];
            $set->entries()->createMany([
                [...$band, 'metric_key' => 'rt_mean', 'sex' => 'all', 'mean' => 500, 'sd' => 100, 'n' => 60, 'direction' => 'lower_better'],
                [...$band, 'metric_key' => 'hit_rate', 'sex' => 'all', 'mean' => 0.9, 'sd' => 0.04, 'n' => 60, 'direction' => 'higher_better'],
                [...$band, 'metric_key' => 'rt_mean', 'sex' => 'male', 'mean' => 300, 'sd' => 50, 'n' => 30, 'direction' => 'lower_better'],
                ['age_min_years' => 6, 'age_max_years' => 9, 'scope' => 'overall', 'metric_key' => 'rt_mean', 'sex' => 'all', 'mean' => 700, 'sd' => 120, 'n' => 50, 'direction' => 'lower_better'],
            ]);
        });

        $scores = collect($this->getJson("/api/v1/sessions/{$session}/results")->assertOk()
            ->assertJsonPath('norms.name', 'هنجار آزمایشی تهران')->assertJsonPath('norms.age_years', 12)
            ->json('norms.scores'))->keyBy('key');
        // rt_mean 412.68 vs 500±100, faster is better → z = +0.87 → 113, 80.9th percentile.
        $this->assertSame(113, $scores['rt_mean']['standard_score']);
        $this->assertEqualsWithDelta(80.9, $scores['rt_mean']['percentile'], 0.1);
        $this->assertSame('average', $scores['rt_mean']['band']);
        $this->assertSame('10–14', $scores['rt_mean']['age_band']);
        // hit_rate 0.96 vs 0.90±0.04 → z = +1.5 → 123 (above average).
        $this->assertSame(123, $scores['hit_rate']['standard_score']);
        $this->assertSame('high', $scores['hit_rate']['band']);

        $content = $this->postJson("/api/v1/sessions/{$session}/reports")->assertCreated()->json('data.content');
        $this->assertSame('1.1', $content['schema_version']);
        $this->assertSame('هنجار آزمایشی تهران', $content['norms']['name']);
        $this->assertTrue($content['norms']['provisional']);
        $rt = collect($content['sections'][0]['metrics'])->firstWhere('key', 'rt_mean');
        $this->assertSame(113, $rt['norm']['standard_score']);
        $this->assertSame('در محدودهٔ میانگین', $rt['norm']['band_label']);
        $this->assertNull(collect($content['sections'][0]['metrics'])->firstWhere('key', 'trials')['norm']);
        $this->assertContains(__('metrics.provisional_norms', [], 'fa'), $content['disclaimers']);
        $this->assertNotContains(__('metrics.raw_scores', [], 'fa'), $content['disclaimers']);
        $this->assertSame('نوجوانان و بزرگسالان', $content['session']['audience']);
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
        $patient = $this->postJson('/api/v1/patients', ['birth_date' => '2000-01-01'])->json('data.id');
        $version = $this->demoVersion();
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
        $patient = $this->postJson('/api/v1/patients', ['birth_date' => '2000-01-01'])->json('data.id');
        $version = $this->demoVersion();
        $session = $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])->json('data.id');
        $this->postJson("/api/v1/sessions/{$session}/invite")->assertCreated();

        $this->travel(73)->hours();
        $this->artisan('sessions:expire-invites')->assertSuccessful();
        $this->assertSame('EXPIRED', $this->inTenant($tenant, fn () => TestSession::find($session)->status->value));
    }

    public function test_session_creation_respects_the_plan_quota(): void
    {
        $this->actingAsClinic(TenantRole::Owner, 'starter');
        $patient = $this->postJson('/api/v1/patients', ['birth_date' => '2000-01-01'])->json('data.id');
        $version = $this->demoVersion();
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
