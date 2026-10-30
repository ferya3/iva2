<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SessionState extends Model
{
    use BelongsToTenant;

    protected $table = 'session_states';

    public const UPDATED_AT = null;

    protected $fillable = ['tenant_id', 'session_id', 'from_status', 'to_status', 'actor_type', 'actor_id', 'reason'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
