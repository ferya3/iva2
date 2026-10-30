<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CalibrationResult extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'calibration_results';

    public const UPDATED_AT = null;

    protected $fillable = ['tenant_id', 'session_id', 'verdict', 'refresh_rate_hz', 'result'];

    protected function casts(): array
    {
        return ['result' => 'array', 'refresh_rate_hz' => 'float', 'created_at' => 'datetime'];
    }
}
