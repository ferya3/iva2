<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class SessionEvent extends Model
{
    use BelongsToTenant;

    protected $table = 'session_events';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['payload' => 'array', 'logged_time_ms' => 'float'];
    }
}
