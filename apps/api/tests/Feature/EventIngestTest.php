<?php

namespace Tests\Feature;

use App\Domain\Events\EventBatchValidator;
use App\Domain\Events\EventStream;
use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\TenantRole;
use App\Models\AssessmentVersion;
use App\Models\TestSession;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class EventIngestTest extends TestCase
{
    private TestSession $session;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        [$tenant, $user] = $this->actingAsClinic(TenantRole::Clinician);
        $patient = $this->postJson('/api/v1/patients', ['patient_code' => 'P-9'])->json('data.id');
        $version = AssessmentVersion::query()->published()->first();
        $id = $this->postJson('/api/v1/sessions', ['patient_id' => $patient, 'assessment_version_id' => $version->id])->json('data.id');
        $code = $this->postJson("/api/v1/sessions/{$id}/invite")->json('code');
        $this->token = $this->postJson('/api/v1/player/join', ['code' => $code, 'device_id' => 'dev-1'])->json('token');

        $this->session = $this->inTenant($tenant, function () use ($id) {
            $s = TestSession::findOrFail($id);
            app(SessionStateMachine::class)->path($s, [SessionStatus::DeviceCheck, SessionStatus::Calibration, SessionStatus::Ready, SessionStatus::Running], 'system');

            return $s;
        });
    }

    private function batch(array $events, ?string $batchId = null): array
    {
        return ['session_id' => $this->session->id, 'batch_id' => $batchId ?? (string) Str::uuid(), 'engine_version' => '1.0.0', 'events' => $events];
    }

    private function send(array $batch)
    {
        return $this->withToken($this->token)->postJson("/api/v1/sessions/{$this->session->id}/events/batch", $batch);
    }

    private function fixtureEvents(): array
    {
        return $this->eventFixture()['events'];
    }

    public function test_the_shared_contract_fixture_is_valid_for_the_api(): void
    {
        $fixture = $this->eventFixture();
        $this->assertSame($fixture, app(EventBatchValidator::class)->validate($fixture));
    }

    public function test_the_validator_rejects_what_the_typescript_schema_rejects(): void
    {
        $cases = [
            'gap' => fn ($b) => data_set($b, 'events.2.sequence', 9),
            'decreasing time' => fn ($b) => data_set($b, 'events.3.timestamp_ms', 1),
            'unknown type' => fn ($b) => data_set($b, 'events.1.type', 'keylogger_dump'),
            'bad uuid' => fn ($b) => data_set($b, 'batch_id', 'batch-1'),
            'bad enum' => fn ($b) => data_set($b, 'events.2.presentation_status', 'perfect'),
            'string number' => fn ($b) => data_set($b, 'events.2.actual_time_ms', '1050.25'),
            'missing field' => function ($b) {
                unset($b['events'][2]['planned_time_ms']);

                return $b;
            },
            'too many events' => fn ($b) => data_set($b, 'events', array_map(
                fn ($i) => ['sequence' => $i, 'type' => 'marker', 'timestamp_ms' => 1, 'label' => 'x'],
                range(1, config('cognitest.events.max_batch_events') + 1),
            )),
        ];
        foreach ($cases as $name => $mutate) {
            try {
                app(EventBatchValidator::class)->validate($mutate($this->eventFixture()));
                $this->fail("{$name}: expected rejection");
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_stores_events_into_the_typed_tables(): void
    {
        $batch = $this->batch($this->fixtureEvents());
        $this->send($batch)->assertCreated()->assertExactJson([
            'batch_id' => $batch['batch_id'], 'accepted' => 5, 'duplicate' => false, 'last_sequence' => 5,
        ]);

        $this->assertDatabaseHas('stimulus_events', [
            'session_id' => $this->session->id, 'sequence_number' => 3, 'planned_time_ms' => 1050, 'actual_present_time_ms' => 1050.25, 'frame_number' => 63,
        ]);
        $stimulusId = \DB::table('stimulus_events')->where('session_id', $this->session->id)->value('id');
        $this->assertDatabaseHas('response_events', [
            'sequence_number' => 4, 'stimulus_event_id' => $stimulusId, 'reaction_time_ms' => 432.35, 'received_time_ms' => 1482.6, 'validity_status' => 'valid',
        ]);
        $this->assertDatabaseCount('session_events', 3);
        $this->assertSame(5, $this->session->refresh()->last_sequence);
    }

    public function test_a_replayed_batch_is_acknowledged_once(): void
    {
        $batch = $this->batch($this->fixtureEvents());
        $this->send($batch)->assertCreated();
        $this->send($batch)->assertOk()->assertJson(['duplicate' => true, 'accepted' => 0, 'last_sequence' => 5]);
        $this->assertDatabaseCount('stimulus_events', 1);
    }

    public function test_a_reused_batch_id_with_other_data_is_rejected(): void
    {
        $batch = $this->batch($this->fixtureEvents());
        $this->send($batch)->assertCreated();
        $batch['events'][4]['timestamp_ms'] = 1600.0;
        $this->send($batch)->assertStatus(422)->assertJsonPath('code', 'batch_id_reused');
    }

    public function test_a_gap_returns_the_expected_sequence(): void
    {
        $events = $this->fixtureEvents();
        $this->send($this->batch(array_slice($events, 0, 2)))->assertCreated();
        $tail = array_map(fn ($e) => [...$e, 'sequence' => $e['sequence'] + 1], array_slice($events, 2));
        $this->send($this->batch($tail))->assertStatus(409)
            ->assertJsonPath('code', 'sequence_conflict')
            ->assertJsonPath('details.expected_sequence', 3);
    }

    public function test_batches_are_accepted_only_while_running(): void
    {
        $this->inTenant($this->session->tenant, fn () => app(SessionStateMachine::class)->transition($this->session, SessionStatus::Invalid, 'system'));
        $this->send($this->batch($this->fixtureEvents()))->assertStatus(409)->assertJsonPath('code', 'session_not_running');
    }

    public function test_a_token_cannot_write_to_another_session(): void
    {
        $other = (string) Str::uuid();
        $batch = [...$this->batch($this->fixtureEvents()), 'session_id' => $other];
        $this->withToken($this->token)->postJson("/api/v1/sessions/{$other}/events/batch", $batch)->assertStatus(403);
        $this->withToken('not-a-token')->postJson("/api/v1/sessions/{$this->session->id}/events/batch", $this->batch($this->fixtureEvents()))->assertStatus(401);
    }

    public function test_the_body_of_the_batch_must_match_the_url_session(): void
    {
        $batch = [...$this->batch($this->fixtureEvents()), 'session_id' => (string) Str::uuid()];
        $this->send($batch)->assertStatus(422)->assertJsonPath('code', 'session_mismatch');
    }

    public function test_the_full_demo_stream_round_trips_exactly(): void
    {
        $events = $this->demoEvents();
        foreach (array_chunk($events, 200) as $chunk) {
            $this->send($this->batch($chunk))->assertCreated();
        }
        $stored = $this->inTenant($this->session->tenant, fn () => app(EventStream::class)->forSession($this->session));
        // Same events, same values, bit-exact doubles (key order is irrelevant).
        $canonical = fn (array $list) => json_encode(array_map(function ($e) {
            ksort($e);

            return $e;
        }, $list));
        $this->assertCount(count($events), $stored);
        $this->assertSame($canonical($events), $canonical($stored));
    }
}
