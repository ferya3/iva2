<?php

namespace App\Domain\Events;

use Illuminate\Validation\ValidationException;

/**
 * PHP mirror of `eventBatchSchema` (packages/validation/src/events.ts).
 * Hand-written instead of Laravel rule arrays because a batch carries up to
 * 500 heterogeneous events and must validate in well under a millisecond
 * per event. Parity is pinned by EventBatchContractTest, which validates
 * the same JSON fixture as the TypeScript test-suite.
 */
final class EventBatchValidator
{
    // Same as zod's z.uuid(): RFC 9562 layout, versions 1–8.
    private const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

    private const SEMVER = '/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/';

    /** Field specs per event type: name => type[:option] */
    private const SPECS = [
        'session_started' => [
            'engine_version' => 'text', 'protocol_key' => 'text', 'protocol_version' => 'text',
            'seed' => 'uint32', 'wall_clock_iso' => 'datetime',
        ],
        'session_ended' => ['reason' => 'enum:completed,aborted'],
        'block_started' => ['block_index' => 'index', 'block_key' => 'text'],
        'block_ended' => ['block_index' => 'index'],
        'stimulus_presented' => [
            'trial_index' => 'index', 'block_index' => 'index', 'stimulus_id' => 'text',
            'modality' => 'enum:visual,auditory', 'is_target' => 'bool',
            'planned_time_ms' => 'ms', 'actual_time_ms' => 'ms', 'frame_number' => '?index',
            'presentation_status' => 'enum:on_time,late,dropped',
        ],
        'stimulus_cleared' => ['trial_index' => 'index'],
        'response' => [
            'received_time_ms' => 'ms', 'input' => 'enum:keyboard,mouse', 'key' => 'text',
            'stimulus_sequence' => '?sequence', 'reaction_time_ms' => '?number',
            'validity' => 'enum:valid,anticipatory,late,unmatched',
        ],
        'focus_lost' => [], 'focus_gained' => [], 'visibility_hidden' => [], 'visibility_visible' => [],
        'frame_drop' => ['expected_interval_ms' => 'positive', 'observed_interval_ms' => 'positive', 'dropped_frames' => 'sequence'],
        'audio_error' => ['message' => 'longtext'],
        'marker' => ['label' => 'text'],
    ];

    private array $errors = [];

    /** @throws ValidationException */
    public function validate(mixed $batch): array
    {
        $this->errors = [];
        if (! is_array($batch)) {
            $this->fail('', 'Batch must be a JSON object.');
            $this->throw();
        }

        $this->match('session_id', $batch['session_id'] ?? null, self::UUID, 'must be a UUID');
        $this->match('batch_id', $batch['batch_id'] ?? null, self::UUID, 'must be a UUID');
        $this->match('engine_version', $batch['engine_version'] ?? null, self::SEMVER, 'must be a semantic version');

        $events = $batch['events'] ?? null;
        $max = config('cognitest.events.max_batch_events');
        if (! is_array($events) || ! array_is_list($events) || $events === []) {
            $this->fail('events', 'must be a non-empty array');
        } elseif (count($events) > $max) {
            $this->fail('events', "must not contain more than {$max} events");
        } else {
            foreach ($events as $i => $event) {
                $this->validateEvent("events.{$i}", $event);
                if ($i > 0 && is_array($event) && is_array($events[$i - 1])) {
                    $prev = $events[$i - 1];
                    if (is_int($event['sequence'] ?? null) && is_int($prev['sequence'] ?? null) && $event['sequence'] !== $prev['sequence'] + 1) {
                        $this->fail("events.{$i}.sequence", 'sequence must be contiguous: expected '.($prev['sequence'] + 1));
                    }
                    if ($this->isNumber($event['timestamp_ms'] ?? null) && $this->isNumber($prev['timestamp_ms'] ?? null) && $event['timestamp_ms'] < $prev['timestamp_ms']) {
                        $this->fail("events.{$i}.timestamp_ms", 'timestamps must be non-decreasing');
                    }
                }
                if (count($this->errors) > 50) {
                    break;
                }
            }
        }

        $this->throw();

        return $batch;
    }

    private function validateEvent(string $path, mixed $event): void
    {
        if (! is_array($event)) {
            $this->fail($path, 'must be an object');

            return;
        }
        $type = $event['type'] ?? null;
        if (! is_string($type) || ! isset(self::SPECS[$type])) {
            $this->fail("{$path}.type", 'is not a known event type');

            return;
        }
        $this->check("{$path}.sequence", $event, 'sequence', 'sequence');
        $this->check("{$path}.timestamp_ms", $event, 'timestamp_ms', 'ms');
        foreach (self::SPECS[$type] as $field => $spec) {
            $this->check("{$path}.{$field}", $event, $field, $spec);
        }
    }

    private function check(string $path, array $event, string $field, string $spec): void
    {
        $nullable = str_starts_with($spec, '?');
        $spec = ltrim($spec, '?');
        if (! array_key_exists($field, $event)) {
            $this->fail($path, 'is required');

            return;
        }
        $v = $event[$field];
        if ($v === null) {
            if (! $nullable) {
                $this->fail($path, 'must not be null');
            }

            return;
        }
        $maxLen = config('cognitest.events.max_string_length');
        $ok = match (true) {
            $spec === 'text' => is_string($v) && $v !== '' && mb_strlen($v) <= $maxLen,
            $spec === 'longtext' => is_string($v) && mb_strlen($v) <= 1024,
            $spec === 'bool' => is_bool($v),
            $spec === 'index' => is_int($v) && $v >= 0,
            $spec === 'sequence' => is_int($v) && $v >= 1,
            $spec === 'uint32' => is_int($v) && $v >= 0 && $v <= 4294967295,
            $spec === 'number' => $this->isNumber($v),
            $spec === 'positive' => $this->isNumber($v) && $v > 0,
            $spec === 'ms' => $this->isNumber($v) && $v >= 0 && $v <= config('cognitest.events.max_timestamp_ms'),
            $spec === 'datetime' => is_string($v) && strtotime($v) !== false
                && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/', $v) === 1,
            str_starts_with($spec, 'enum:') => is_string($v) && in_array($v, explode(',', substr($spec, 5)), true),
            default => false,
        };
        if (! $ok) {
            $this->fail($path, "must be {$spec}");
        }
    }

    private function isNumber(mixed $v): bool
    {
        return (is_int($v) || is_float($v)) && is_finite((float) $v);
    }

    private function match(string $path, mixed $value, string $pattern, string $message): void
    {
        if (! is_string($value) || ! preg_match($pattern, $value)) {
            $this->fail($path, $message);
        }
    }

    private function fail(string $path, string $message): void
    {
        $this->errors[$path ?: 'batch'][] = trim("{$path} {$message}");
    }

    private function throw(): void
    {
        if ($this->errors !== []) {
            throw ValidationException::withMessages($this->errors);
        }
    }
}
