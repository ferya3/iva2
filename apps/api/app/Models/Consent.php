<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Consent extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'patient_id', 'consent_type', 'version', 'accepted_by_name', 'accepted_at', 'revoked_at', 'recorded_by'];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime', 'revoked_at' => 'datetime'];
    }
}
