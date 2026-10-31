<?php

namespace App\Http\Resources;

use App\Models\TestSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin TestSession */
class TestSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'patient_id' => $this->patient_id,
            'patient' => $this->whenLoaded('patient', fn () => [
                'id' => $this->patient->id,
                'patient_code' => $this->patient->patient_code,
            ]),
            'assessment_version_id' => $this->assessment_version_id,
            'assessment' => $this->whenLoaded('assessmentVersion', fn () => [
                'name' => $this->assessmentVersion->type?->name,
                'version' => $this->assessmentVersion->version,
                'is_clinical' => $this->assessmentVersion->is_clinical,
                'audience' => $this->assessmentVersion->audience_label,
                'age_range' => $this->assessmentVersion->ageRangeLabel(),
            ]),
            'status' => $this->status->value,
            'validity_status' => $this->validity_status,
            'created_by' => $this->created_by,
            'last_sequence' => $this->last_sequence,
            'expected_final_sequence' => $this->expected_final_sequence,
            'engine_version' => $this->engine_version,
            'notes' => $this->notes,
            'invited_at' => $this->invited_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'calibration' => $this->whenLoaded('latestCalibration', fn () => $this->latestCalibration ? [
                'verdict' => $this->latestCalibration->verdict,
                'refresh_rate_hz' => $this->latestCalibration->refresh_rate_hz,
            ] : null),
            'history' => $this->whenLoaded('states', fn () => $this->states->map(fn ($s) => [
                'from' => $s->from_status,
                'to' => $s->to_status,
                'actor_type' => $s->actor_type,
                'reason' => $s->reason,
                'at' => $s->created_at?->toIso8601String(),
            ])),
        ];
    }
}
