<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DeviceProfile extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'device_profiles';

    public const UPDATED_AT = null;

    protected $fillable = ['tenant_id', 'session_id', 'device_info'];

    protected function casts(): array
    {
        return ['device_info' => 'array', 'created_at' => 'datetime'];
    }
}
