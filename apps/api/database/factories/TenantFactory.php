<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Tenant> */
class TenantFactory extends Factory
{
    public function definition(): array
    {
        $name = 'Clinic '.fake()->unique()->word();

        return ['name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)), 'status' => 'active'];
    }
}
