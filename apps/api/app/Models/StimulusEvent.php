<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class StimulusEvent extends Model
{
    use BelongsToTenant;

    protected $table = 'stimulus_events';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_target' => 'boolean', 'planned_time_ms' => 'float', 'actual_present_time_ms' => 'float', 'logged_time_ms' => 'float'];
    }
}
