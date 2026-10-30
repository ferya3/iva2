<?php

namespace App\Jobs;

use App\Domain\Reports\ReportService;
use App\Domain\Tenancy\TenantContext;
use App\Models\Report;
use App\Models\Tenant;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

final class RenderReportPdfJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [15, 60, 180];

    public function __construct(
        public readonly string $reportId,
        public readonly string $tenantId,
    ) {
        $this->onQueue('reports');
    }

    public function handle(TenantContext $context, ReportService $reports): void
    {
        $tenant = $context->runAsSystem(fn () => Tenant::findOrFail($this->tenantId));
        $context->runAs($tenant, fn () => $reports->renderPdf(Report::findOrFail($this->reportId)));
    }
}
