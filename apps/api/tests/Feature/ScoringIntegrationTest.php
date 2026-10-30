<?php

namespace Tests\Feature;

use App\Domain\Events\EventIngestor;
use App\Domain\Reports\ChromiumPdfRenderer;
use App\Domain\Reports\ReportBuilder;
use App\Domain\Scoring\NodeScoringEngine;
use App\Domain\Scoring\ScoreSession;
use App\Domain\Scoring\ScoringEngine;
use App\Domain\Scoring\ScoringFailed;
use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Models\AssessmentVersion;
use App\Models\Patient;
use App\Models\TestSession;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Runs the real TypeScript scoring engine (Node subprocess) and, when a
 * Chromium binary is available, the real PDF renderer. CI builds the CLI
 * before the PHP suite; locally run `pnpm --filter @cognitest/scoring-engine build`.
 */
class ScoringIntegrationTest extends TestCase
{
    private function engine(): ScoringEngine
    {
        $engine = app(ScoringEngine::class);
        if (! is_file(base_path(config('cognitest.scoring.cli_path')))) {
            $this->markTestSkipped('scoring CLI not built');
        }

        return $engine;
    }

    public function test_the_node_engine_scores_the_demo_session(): void
    {
        $result = $this->engine()->score($this->demoEvents(), ['practiceBlockKeys' => ['practice']]);

        $this->assertSame('generic-cpt/1.0.0', $result['algorithm_version']);
        $this->assertSame('valid', $result['validity_status']);
        $overall = collect($result['metrics'])->where('scope', 'overall')->keyBy('key');
        $this->assertSame(200, $overall['trials']['value']);
        $this->assertSame(0.96, $overall['hit_rate']['value']);
        $this->assertEqualsWithDelta(412.683, $overall['rt_mean']['value'], 0.001);
    }

    public function test_malformed_input_is_reported_not_swallowed(): void
    {
        $this->expectException(ScoringFailed::class);
        $this->expectExceptionMessage('exited with 2');
        $this->engine()->score([['type' => 'nonsense']], []);
    }

    public function test_a_missing_cli_fails_loudly(): void
    {
        $this->expectException(ScoringFailed::class);
        (new NodeScoringEngine('node', '/nope/cli.mjs', 5))->score([], []);
    }

    public function test_pipeline_to_a_real_pdf(): void
    {
        $this->engine();
        $chromium = env('PDF_CHROMIUM_BINARY_TEST', '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell');
        if (! is_executable($chromium)) {
            $this->markTestSkipped('no Chromium binary for PDF rendering');
        }

        [$tenant] = $this->actingAsClinic();
        $session = $this->inTenant($tenant, function () {
            $patient = Patient::create(['patient_code' => 'P-PDF']);
            $s = TestSession::create(['patient_id' => $patient->id, 'assessment_version_id' => AssessmentVersion::query()->published()->first()->id]);
            $states = app(SessionStateMachine::class);
            $states->path($s, [SessionStatus::Invited, SessionStatus::DeviceCheck, SessionStatus::Calibration, SessionStatus::Ready, SessionStatus::Running], 'system');
            $events = $this->demoEvents();
            app(EventIngestor::class)->ingest($s, ['session_id' => $s->id, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => array_slice($events, 0, 500)]);
            app(EventIngestor::class)->ingest($s, ['session_id' => $s->id, 'batch_id' => (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => array_slice($events, 500)]);
            $states->path($s, [SessionStatus::Uploading, SessionStatus::Completed], 'system', null, ['completed_at' => now()]);
            app(ScoreSession::class)->run($s->refresh());

            return $s->refresh();
        });
        $this->assertSame(SessionStatus::Validated, $session->status);

        $doc = $this->inTenant($tenant, fn () => app(ReportBuilder::class)->build($session, $session->latestSucceededRun, 1));
        $pdf = (new ChromiumPdfRenderer($chromium, 60))->render(view('reports.pdf', ['doc' => $doc])->render());

        $this->assertStringStartsWith('%PDF-', $pdf);
        $this->assertGreaterThan(10_000, strlen($pdf));
        file_put_contents(storage_path('app/sample-report.pdf'), $pdf);
    }
}
