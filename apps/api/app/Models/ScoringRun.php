<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ScoringRun extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'session_id', 'scoring_version_id', 'algorithm_version', 'status', 'input_sha256', 'error', 'requested_by', 'started_at', 'finished_at'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'finished_at' => 'datetime'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TestSession::class, 'session_id');
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(ScoringMetric::class);
    }

    public function validity(): HasOne
    {
        return $this->hasOne(ValidityResult::class);
    }
}
