<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Report extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'session_id', 'scoring_run_id', 'report_version', 'status', 'content', 'generated_by'];

    protected function casts(): array
    {
        return ['content' => 'array', 'report_version' => 'integer'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TestSession::class, 'session_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(ReportFile::class);
    }

    public function pdf(): HasOne
    {
        return $this->hasOne(ReportFile::class)->where('mime_type', 'application/pdf')->orderByDesc('created_at')->orderByDesc('id');
    }
}
