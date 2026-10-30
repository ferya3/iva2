<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ResponseEvent extends Model
{
    use BelongsToTenant;

    protected $table = 'response_events';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['received_time_ms' => 'float', 'logged_time_ms' => 'float', 'reaction_time_ms' => 'float'];
    }
}
