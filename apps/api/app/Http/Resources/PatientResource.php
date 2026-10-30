<?php

namespace App\Http\Resources;

use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Patient */
class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->profile;

        return [
            'id' => $this->id,
            'patient_code' => $this->patient_code,
            'first_name' => $profile?->first_name,
            'last_name' => $profile?->last_name,
            'birth_date' => $profile?->birth_date?->format('Y-m-d'),
            'age_years' => $profile?->ageYears(),
            'sex' => $profile?->sex,
            'handedness' => $profile?->handedness,
            'education' => $profile?->education,
            // Identity fields only on the detail endpoint.
            'national_id' => $this->when($request->routeIs('patients.show'), fn () => $profile?->national_id),
            'phone' => $this->when($request->routeIs('patients.show'), fn () => $profile?->phone),
            'sessions_count' => $this->whenCounted('sessions'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
