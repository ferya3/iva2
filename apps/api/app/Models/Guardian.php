<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Guardian extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'patient_id', 'full_name', 'relation', 'phone'];

    protected function casts(): array
    {
        return ['phone' => 'encrypted'];
    }
}
