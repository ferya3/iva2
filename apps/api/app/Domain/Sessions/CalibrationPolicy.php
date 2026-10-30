<?php

namespace App\Domain\Sessions;

/**
 * Server-side re-check of the player's calibration verdict against the
 * assessment version's thresholds. The stricter of the two verdicts wins,
 * so a modified client cannot talk its way past calibration.
 * Defaults mirror DEFAULT_THRESHOLDS in packages/calibration.
 */
final class CalibrationPolicy
{
    public const DEFAULTS = [
        'min_refresh_hz' => 59,
        'max_frame_sd_ms' => 2.0,
        'max_dropped_ratio' => 0.01,
        'max_input_dispatch_p95_ms' => 16,
        'require_audio' => false,
        'max_audio_output_latency_ms' => 120,
    ];

    /** @return array{verdict: string, reasons: list<array{code: string, message: string}>} */
    public function evaluate(array $result, array $thresholds = []): array
    {
        $t = array_merge(self::DEFAULTS, $thresholds);
        $reasons = [];
        $display = $result['display'];

        if ($display['refresh_rate_hz'] < $t['min_refresh_hz']) {
            $reasons[] = ['code' => 'display.refresh_rate', 'message' => "refresh rate below {$t['min_refresh_hz']} Hz"];
        }
        if ($display['frame_interval_sd_ms'] > $t['max_frame_sd_ms']) {
            $reasons[] = ['code' => 'display.jitter', 'message' => 'frame interval jitter too high'];
        }
        if ($display['dropped_frame_ratio'] > $t['max_dropped_ratio']) {
            $reasons[] = ['code' => 'display.dropped_frames', 'message' => 'too many dropped frames'];
        }
        $p95 = $result['input']['dispatch_latency_p95_ms'] ?? null;
        if ($p95 !== null && $p95 > $t['max_input_dispatch_p95_ms']) {
            $reasons[] = ['code' => 'input.dispatch_latency', 'message' => 'input dispatch latency too high'];
        }
        if ($t['require_audio'] && ! ($result['audio']['available'] ?? false)) {
            $reasons[] = ['code' => 'audio.unavailable', 'message' => 'audio output is required'];
        }
        $audioLatency = $result['audio']['output_latency_ms'] ?? null;
        if ($audioLatency !== null && $audioLatency > $t['max_audio_output_latency_ms']) {
            $reasons[] = ['code' => 'audio.output_latency', 'message' => 'audio output latency too high'];
        }

        $server = $reasons === [] ? 'pass' : 'fail';
        $rank = ['pass' => 0, 'warn' => 1, 'fail' => 2];
        $client = $result['verdict'] ?? 'fail';

        return [
            'verdict' => $rank[$server] >= ($rank[$client] ?? 2) ? $server : $client,
            'reasons' => $reasons,
        ];
    }
}
