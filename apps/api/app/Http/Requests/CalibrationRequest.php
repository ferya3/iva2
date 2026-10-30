<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Mirrors calibrationResultSchema in packages/validation. */
class CalibrationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'display' => ['required', 'array'],
            'display.samples' => ['required', 'integer', 'min:1'],
            'display.refresh_rate_hz' => ['required', 'numeric', 'gt:0', 'max:1000'],
            'display.frame_interval_mean_ms' => ['required', 'numeric', 'gt:0'],
            'display.frame_interval_sd_ms' => ['required', 'numeric', 'min:0'],
            'display.frame_interval_p99_ms' => ['required', 'numeric', 'gt:0'],
            'display.dropped_frame_ratio' => ['required', 'numeric', 'between:0,1'],
            'input' => ['required', 'array'],
            'input.samples' => ['required', 'integer', 'min:0'],
            'input.dispatch_latency_mean_ms' => ['present', 'nullable', 'numeric', 'min:0'],
            'input.dispatch_latency_p95_ms' => ['present', 'nullable', 'numeric', 'min:0'],
            'audio' => ['required', 'array'],
            'audio.available' => ['required', 'boolean'],
            'audio.sample_rate' => ['present', 'nullable', 'numeric', 'gt:0'],
            'audio.base_latency_ms' => ['present', 'nullable', 'numeric', 'min:0'],
            'audio.output_latency_ms' => ['present', 'nullable', 'numeric', 'min:0'],
            'verdict' => ['required', 'in:pass,warn,fail'],
            'reasons' => ['present', 'array'],
            'reasons.*.code' => ['required', 'string', 'max:64'],
            'reasons.*.message' => ['required', 'string', 'max:255'],
        ];
    }
}
