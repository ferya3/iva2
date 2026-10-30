<?php

namespace Database\Seeders;

use App\Domain\Tenancy\TenantContext;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(TenantContext $context): void
    {
        $context->runAsSystem(function () {
            $this->call([RbacSeeder::class, PlanSeeder::class, AssessmentCatalogSeeder::class]);
        });

        if (app()->environment(['local', 'demo'])) {
            $this->call(DemoSeeder::class);
        }
    }
}
