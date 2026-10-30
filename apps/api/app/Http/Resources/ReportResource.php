<?php

namespace App\Http\Resources;

use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Report */
class ReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'session_id' => $this->session_id,
            'report_version' => $this->report_version,
            'status' => $this->status,
            'pdf_ready' => $this->pdf()->exists(),
            'content' => $this->content,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
