<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ScoringMetric extends Model
{
    use BelongsToTenant;

    protected $table = 'scoring_metrics';

    public $timestamps = false;

    protected $fillable = ['tenant_id', 'scoring_run_id', 'metric_key', 'scope', 'value', 'unit'];

    protected function casts(): array
    {
        return ['value' => 'float'];
    }
}
