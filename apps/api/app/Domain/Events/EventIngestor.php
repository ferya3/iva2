<?php

namespace App\Domain\Events;

use App\Domain\Sessions\SessionLifecycle;
use App\Exceptions\ApiException;
use App\Models\EventBatch;
use App\Models\TestSession;
use Illuminate\Support\Facades\DB;

/**
 * Stores one batch of raw events, exactly once.
 *
 * Under a row lock on the session it checks, in order:
 *  - the session accepts events (RUNNING / UPLOADING);
 *  - batch_id is new — a replay with identical payload is acknowledged as a
 *    duplicate, a different payload under the same id is rejected;
 *  - the batch continues the stream exactly at last_sequence + 1 — otherwise
 *    409 with the expected sequence so the player can resynchronise.
 * Rows are then bulk-inserted into the append-only event tables and the
 * session's ingest cursor advances in the same transaction.
 */
final class EventIngestor
{
    private const CHUNK = 250;

    public function __construct(private readonly SessionLifecycle $lifecycle) {}

    public function ingest(TestSession $session, array $batch): BatchResult
    {
        if ($batch['session_id'] !== $session->id) {
            throw new ApiException('Batch belongs to a different session.', 'session_mismatch', 422);
        }
        $hash = hash('sha256', json_encode($batch['events'], JSON_PRESERVE_ZERO_FRACTION | JSON_UNESCAPED_UNICODE));

        $result = DB::transaction(function () use ($session, $batch, $hash) {
            /** @var TestSession $locked */
            $locked = TestSession::query()->lockForUpdate()->findOrFail($session->id);

            $existing = EventBatch::query()->find($batch['batch_id']);
            if ($existing) {
                if ($existing->session_id !== $locked->id || $existing->payload_sha256 !== $hash) {
                    throw new ApiException('batch_id was already used for different data.', 'batch_id_reused', 422);
                }

                return new BatchResult($existing->id, 0, true, $locked->last_sequence);
            }

            if (! $locked->status->acceptsEvents()) {
                throw new ApiException('Session is not accepting events.', 'session_not_running', 409, ['status' => $locked->status->value]);
            }

            $events = $batch['events'];
            $first = $events[0]['sequence'];
            $last = end($events)['sequence'];
            $expected = $locked->last_sequence + 1;
            if ($first !== $expected) {
                throw new ApiException('Batch does not continue the event stream.', 'sequence_conflict', 409, ['expected_sequence' => $expected]);
            }

            EventBatch::create([
                'id' => $batch['batch_id'],
                'tenant_id' => $locked->tenant_id,
                'session_id' => $locked->id,
                'first_sequence' => $first,
                'last_sequence' => $last,
                'event_count' => count($events),
                'payload_sha256' => $hash,
                'engine_version' => $batch['engine_version'],
                'status' => 'accepted',
                'received_at' => now(),
            ]);
            $this->insertEvents($locked, $batch['batch_id'], $events);

            $locked->forceFill(['last_sequence' => $last, 'engine_version' => $batch['engine_version']])->save();
            $session->setRawAttributes($locked->getAttributes(), true);

            return new BatchResult($batch['batch_id'], count($events), false, $last);
        });

        // Finishing an upload that was announced earlier (outside the batch tx).
        if (! $result->duplicate && $this->lifecycle->completeIfFullyUploaded($session)) {
            return new BatchResult($result->batchId, $result->accepted, false, $result->lastSequence, true);
        }

        return $result;
    }

    private function insertEvents(TestSession $session, string $batchId, array $events): void
    {
        $base = ['tenant_id' => $session->tenant_id, 'session_id' => $session->id, 'batch_id' => $batchId];
        $stimuli = [];
        $responses = [];
        $others = [];

        foreach ($events as $e) {
            match ($e['type']) {
                'stimulus_presented' => $stimuli[] = $base + [
                    'sequence_number' => $e['sequence'],
                    'block_index' => $e['block_index'],
                    'trial_index' => $e['trial_index'],
                    'stimulus_code' => $e['stimulus_id'],
                    'modality' => $e['modality'],
                    'is_target' => $e['is_target'],
                    'planned_time_ms' => $e['planned_time_ms'],
                    'actual_present_time_ms' => $e['actual_time_ms'],
                    'logged_time_ms' => $e['timestamp_ms'],
                    'frame_number' => $e['frame_number'],
                    'presentation_status' => $e['presentation_status'],
                ],
                'response' => $responses[] = $base + [
                    'sequence_number' => $e['sequence'],
                    'stimulus_sequence' => $e['stimulus_sequence'],
                    'response_type' => $e['key'],
                    'input_type' => $e['input'],
                    'received_time_ms' => $e['received_time_ms'],
                    'logged_time_ms' => $e['timestamp_ms'],
                    'reaction_time_ms' => $e['reaction_time_ms'],
                    'validity_status' => $e['validity'],
                ],
                default => $others[] = $base + [
                    'sequence_number' => $e['sequence'],
                    'event_type' => $e['type'],
                    'logged_time_ms' => $e['timestamp_ms'],
                    'payload' => json_encode(
                        array_diff_key($e, ['sequence' => 1, 'type' => 1, 'timestamp_ms' => 1]) ?: new \stdClass,
                        JSON_PRESERVE_ZERO_FRACTION | JSON_UNESCAPED_UNICODE,
                    ),
                ],
            };
        }

        foreach (array_chunk($stimuli, self::CHUNK) as $chunk) {
            DB::table('stimulus_events')->insert($chunk);
        }

        if ($responses !== []) {
            // Link responses to their stimulus row (same or an earlier batch).
            $ids = DB::table('stimulus_events')
                ->where('session_id', $session->id)
                ->whereIn('sequence_number', array_filter(array_column($responses, 'stimulus_sequence')))
                ->pluck('id', 'sequence_number');
            foreach ($responses as &$r) {
                $r['stimulus_event_id'] = $r['stimulus_sequence'] !== null ? ($ids[$r['stimulus_sequence']] ?? null) : null;
            }
            unset($r);
            foreach (array_chunk($responses, self::CHUNK) as $chunk) {
                DB::table('response_events')->insert($chunk);
            }
        }

        foreach (array_chunk($others, self::CHUNK) as $chunk) {
            DB::table('session_events')->insert($chunk);
        }
    }
}
