<?php

namespace App\Domain\Reports;

use App\Domain\Sessions\SessionStateMachine;
use App\Domain\Sessions\SessionStatus;
use App\Exceptions\ApiException;
use App\Jobs\RenderReportPdfJob;
use App\Models\Report;
use App\Models\ReportFile;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class ReportService
{
    public function __construct(
        private readonly ReportBuilder $builder,
        private readonly SessionStateMachine $states,
        private readonly PdfRenderer $pdf,
    ) {}

    public function generate(TestSession $session, User $by): Report
    {
        if (! in_array($session->status, [SessionStatus::Validated, SessionStatus::Reported], true)) {
            throw new ApiException('Reports can only be generated for validated sessions.', 'session_not_reportable', 409, ['status' => $session->status->value]);
        }
        $run = $session->latestSucceededRun ?? throw new ApiException('Session has not been scored.', 'not_scored', 409);

        $report = DB::transaction(function () use ($session, $run, $by) {
            // Serialise concurrent generations per session via the session row lock.
            TestSession::query()->whereKey($session->id)->lockForUpdate()->first();
            $version = (int) Report::query()->where('session_id', $session->id)->max('report_version') + 1;
            $report = Report::create([
                'session_id' => $session->id,
                'scoring_run_id' => $run->id,
                'report_version' => $version,
                'status' => 'final',
                'content' => $this->builder->build($session, $run, $version),
                'generated_by' => $by->id,
            ]);
            if ($session->status === SessionStatus::Validated) {
                $this->states->transition($session, SessionStatus::Reported, 'user', $by->id);
            }

            return $report;
        });

        RenderReportPdfJob::dispatch($report->id, $report->tenant_id)->afterCommit();

        return $report;
    }

    public function renderPdf(Report $report): ReportFile
    {
        $html = view('reports.pdf', ['doc' => $report->content])->render();
        $bytes = $this->pdf->render($html);
        $disk = config('cognitest.reports.disk');
        $path = "{$report->tenant_id}/{$report->session_id}/report-v{$report->report_version}.pdf";
        Storage::disk($disk)->put($path, $bytes);

        return ReportFile::create([
            'report_id' => $report->id,
            'disk' => $disk,
            'storage_path' => $path,
            'mime_type' => 'application/pdf',
            'sha256' => hash('sha256', $bytes),
            'size_bytes' => strlen($bytes),
        ]);
    }
}
