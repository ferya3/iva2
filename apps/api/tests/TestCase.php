<?php

namespace Tests;

use App\Domain\Reports\PdfRenderer;
use App\Domain\Tenancy\TenantContext;
use App\Domain\Tenancy\TenantProvisioner;
use App\Domain\Tenancy\TenantRole;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Database\Seeders\AssessmentCatalogSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->system(function () {
            $this->seed([RbacSeeder::class, PlanSeeder::class, AssessmentCatalogSeeder::class]);
        });
        $this->app->bind(PdfRenderer::class, fn () => new class implements PdfRenderer
        {
            public function render(string $html): string
            {
                return "%PDF-1.7\n% fake renderer\n".strlen($html);
            }
        });
    }

    protected function system(\Closure $callback): mixed
    {
        return app(TenantContext::class)->runAsSystem($callback);
    }

    protected function inTenant(Tenant $tenant, \Closure $callback): mixed
    {
        return app(TenantContext::class)->runAs($tenant, $callback);
    }

    /**
     * Creates an active clinic with a member of the given role and
     * authenticates as that member.
     *
     * @return array{0: Tenant, 1: User}
     */
    protected function actingAsClinic(TenantRole $role = TenantRole::Owner, string $plan = 'professional'): array
    {
        $owner = User::factory()->create();
        $tenant = $this->system(function () use ($owner, $plan) {
            $tenant = app(TenantProvisioner::class)->provision(['name' => 'Clinic '.uniqid()], $owner, $plan);
            $tenant->update(['status' => 'active']);
            Subscription::query()->where('tenant_id', $tenant->id)->update(['status' => 'active']);

            return $tenant;
        });
        $user = $owner;
        if ($role !== TenantRole::Owner) {
            $user = User::factory()->create();
            TenantUser::create(['tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => $role, 'status' => 'active']);
        }
        Sanctum::actingAs($user);
        $this->withHeader('X-Tenant-ID', $tenant->id);

        return [$tenant, $user];
    }

    protected function eventFixture(): array
    {
        return json_decode(file_get_contents(base_path('../../packages/validation/fixtures/event-batch.valid.json')), true);
    }

    protected function demoEvents(): array
    {
        return json_decode(file_get_contents(database_path('seeders/data/demo-session.events.json')), true);
    }
}
