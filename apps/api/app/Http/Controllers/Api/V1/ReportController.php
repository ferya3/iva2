<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\AuditLogger;
use App\Domain\Reports\ReportService;
use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReportResource;
use App\Jobs\RenderReportPdfJob;
use App\Models\Report;
use App\Models\ReportAccessLog;
use App\Models\TestSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /** Creates a new immutable report version from the latest scoring run. */
    public function store(Request $request, TestSession $session, ReportService $reports, AuditLogger $audit): ReportResource
    {
        $report = $reports->generate($session, $request->user());
        $audit->log('report.generated', $report, ['version' => $report->report_version]);

        return new ReportResource($report);
    }

    public function showForSession(Request $request, TestSession $session): ReportResource
    {
        $report = $session->reports()->latest('report_version')->first()
            ?? throw new ApiException('No report has been generated for this session.', 'report_not_found', 404);
        $this->logAccess($request, $report, 'view');

        return new ReportResource($report);
    }

    /** Re-renders the PDF of an existing report version. */
    public function generatePdf(Report $report): JsonResponse
    {
        RenderReportPdfJob::dispatch($report->id, $report->tenant_id);

        return response()->json(['message' => 'PDF rendering queued.'], 202);
    }

    public function download(Request $request, Report $report): StreamedResponse
    {
        $file = $report->pdf ?? throw new ApiException('The PDF is not ready yet.', 'pdf_not_ready', 409);
        $this->logAccess($request, $report, 'download');
        $name = sprintf('report-%s-v%d.pdf', $report->content['patient']['code'] ?? 'session', $report->report_version);

        return Storage::disk($file->disk)->download($file->storage_path, $name, [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function logAccess(Request $request, Report $report, string $action): void
    {
        ReportAccessLog::create([
            'report_id' => $report->id,
            'user_id' => $request->user()->id,
            'action' => $action,
            'ip' => $request->ip(),
            'accessed_at' => now(),
        ]);
    }
}
