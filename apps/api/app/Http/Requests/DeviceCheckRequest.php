<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Mirrors deviceProfileSchema in packages/validation. */
class DeviceCheckRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'os' => ['required', 'string', 'max:128'],
            'os_version' => ['required', 'string', 'max:64'],
            'app_version' => ['required', 'string', 'max:32'],
            'engine_version' => ['required', 'string', 'max:32'],
            'cpu_model' => ['present', 'nullable', 'string', 'max:256'],
            'cpu_cores' => ['present', 'nullable', 'integer', 'min:1'],
            'memory_gb' => ['present', 'nullable', 'numeric', 'gt:0'],
            'screen' => ['required', 'array'],
            'screen.width' => ['required', 'integer', 'min:1'],
            'screen.height' => ['required', 'integer', 'min:1'],
            'screen.scale_factor' => ['required', 'numeric', 'gt:0'],
            'screen.color_depth' => ['required', 'integer', 'min:1'],
            'gpu' => ['present', 'nullable', 'string', 'max:256'],
            'audio_output' => ['present', 'nullable', 'string', 'max:256'],
        ];
    }
}
