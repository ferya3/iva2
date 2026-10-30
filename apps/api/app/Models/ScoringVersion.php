<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ScoringVersion extends Model
{
    use HasUuids;

    protected $fillable = ['assessment_version_id', 'algorithm_version', 'config', 'is_default'];

    protected function casts(): array
    {
        return ['config' => 'array', 'is_default' => 'boolean'];
    }
}
