<?php

namespace Tests\Unit;

use App\Domain\Sessions\CalibrationPolicy;
use PHPUnit\Framework\TestCase;

class CalibrationPolicyTest extends TestCase
{
    private function calibration(array $display = [], string $verdict = 'pass'): array
    {
        return [
            'display' => $display + ['refresh_rate_hz' => 60.0, 'frame_interval_sd_ms' => 0.3, 'dropped_frame_ratio' => 0.0],
            'input' => ['dispatch_latency_p95_ms' => 2.0],
            'audio' => ['available' => true, 'output_latency_ms' => 30.0],
            'verdict' => $verdict,
        ];
    }

    public function test_accepts_a_healthy_device(): void
    {
        $this->assertSame('pass', (new CalibrationPolicy)->evaluate($this->calibration())['verdict']);
    }

    public function test_server_overrides_a_client_that_claims_pass(): void
    {
        $r = (new CalibrationPolicy)->evaluate($this->calibration(['refresh_rate_hz' => 30.0]));
        $this->assertSame('fail', $r['verdict']);
        $this->assertSame('display.refresh_rate', $r['reasons'][0]['code']);
    }

    public function test_keeps_the_stricter_client_verdict(): void
    {
        $this->assertSame('warn', (new CalibrationPolicy)->evaluate($this->calibration([], 'warn'))['verdict']);
    }

    public function test_uses_version_specific_thresholds(): void
    {
        $r = (new CalibrationPolicy)->evaluate($this->calibration(['refresh_rate_hz' => 100.0]), ['min_refresh_hz' => 120]);
        $this->assertSame('fail', $r['verdict']);
    }
}
