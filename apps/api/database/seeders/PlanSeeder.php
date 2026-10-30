<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Plan structure from the business model. Prices are deliberately 0 until
 * infrastructure, support and validation costs are known — set them from
 * admin-web (prices are in Rial). Existing plans are never overwritten, so
 * re-running the seeder on deploy keeps prices and limits edited by admins.
 */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            ['key' => 'starter', 'name' => 'Starter', 'limits' => ['clinicians' => 1, 'sessions_per_month' => 30, 'advanced_reports' => false]],
            ['key' => 'professional', 'name' => 'Professional', 'limits' => ['clinicians' => 5, 'sessions_per_month' => 200, 'advanced_reports' => true]],
            ['key' => 'clinic', 'name' => 'Clinic', 'limits' => ['clinicians' => 25, 'sessions_per_month' => 1000, 'advanced_reports' => true, 'branches' => true]],
            ['key' => 'enterprise', 'name' => 'Enterprise', 'limits' => ['clinicians' => null, 'sessions_per_month' => null, 'advanced_reports' => true, 'api_access' => true, 'dedicated_install' => true]],
        ];
        foreach ($plans as $plan) {
            Plan::query()->firstOrCreate(['key' => $plan['key']], $plan + ['price_irr' => 0, 'billing_period' => 'monthly', 'is_active' => true]);
        }
    }
}
