<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domain\Audit\AuditLogger;
use App\Domain\Norms\ResearchDataset;
use App\Domain\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\AssessmentVersion;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Consented, anonymised data for norm studies (see ResearchDataset). */
class AdminResearchController extends Controller
{
    public function summary(AssessmentVersion $version, ResearchDataset $dataset): JsonResponse
    {
        return response()->json(['data' => $dataset->summary($version)]);
    }

    public function export(AssessmentVersion $version, ResearchDataset $dataset, AuditLogger $audit, TenantContext $context): StreamedResponse
    {
        $audit->log('admin.research.exported', $version);
        $name = sprintf('cognitest-research-%s-%s.csv', $version->version, now()->format('Ymd'));

        // The body is streamed after the middleware's system context has
        // ended, so it opens its own (otherwise RLS hides every clinic).
        return response()->streamDownload(fn () => $context->runAsSystem(function () use ($version, $dataset) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ResearchDataset::header(), escape: '');
            foreach ($dataset->rows($version) as $row) {
                fputcsv($out, $row, escape: '');
            }
            fclose($out);
        }), $name, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }
}
