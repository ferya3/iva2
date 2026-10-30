<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ValidityResult extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'validity_results';

    protected $fillable = ['tenant_id', 'session_id', 'scoring_run_id', 'validity_status', 'flags', 'reviewed_by', 'review_note'];

    protected function casts(): array
    {
        return ['flags' => 'array'];
    }
}
