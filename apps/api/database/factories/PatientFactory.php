<?php

namespace Database\Factories;

use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Patient> */
class PatientFactory extends Factory
{
    public function definition(): array
    {
        return ['patient_code' => 'P-'.fake()->unique()->numberBetween(10000, 99999)];
    }
}
