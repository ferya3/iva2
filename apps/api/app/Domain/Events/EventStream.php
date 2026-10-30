<?php

namespace App\Domain\Events;

use App\Models\TestSession;
use Illuminate\Support\Facades\DB;

/**
 * Reconstructs the original wire-format event stream of a session from the
 * three raw tables, ordered by sequence. This is the exact input of the
 * scoring engine and of raw-data exports.
 */
final class EventStream
{
    /** @return list<array<string, mixed>> */
    public function forSession(TestSession $session): array
    {
        $events = [];

        foreach (DB::table('stimulus_events')->where('session_id', $session->id)->orderBy('sequence_number')->cursor() as $r) {
            $events[$r->sequence_number] = [
                'sequence' => $r->sequence_number,
                'type' => 'stimulus_presented',
                'timestamp_ms' => (float) $r->logged_time_ms,
                'trial_index' => $r->trial_index,
                'block_index' => $r->block_index,
                'stimulus_id' => $r->stimulus_code,
                'modality' => $r->modality,
                'is_target' => (bool) $r->is_target,
                'planned_time_ms' => (float) $r->planned_time_ms,
                'actual_time_ms' => (float) $r->actual_present_time_ms,
                'frame_number' => $r->frame_number,
                'presentation_status' => $r->presentation_status,
            ];
        }

        foreach (DB::table('response_events')->where('session_id', $session->id)->orderBy('sequence_number')->cursor() as $r) {
            $events[$r->sequence_number] = [
                'sequence' => $r->sequence_number,
                'type' => 'response',
                'timestamp_ms' => (float) $r->logged_time_ms,
                'received_time_ms' => (float) $r->received_time_ms,
                'input' => $r->input_type,
                'key' => $r->response_type,
                'stimulus_sequence' => $r->stimulus_sequence,
                'reaction_time_ms' => $r->reaction_time_ms === null ? null : (float) $r->reaction_time_ms,
                'validity' => $r->validity_status,
            ];
        }

        foreach (DB::table('session_events')->where('session_id', $session->id)->orderBy('sequence_number')->cursor() as $r) {
            $events[$r->sequence_number] = [
                'sequence' => $r->sequence_number,
                'type' => $r->event_type,
                'timestamp_ms' => (float) $r->logged_time_ms,
                ...json_decode($r->payload, true),
            ];
        }

        ksort($events);

        return array_values($events);
    }
}
