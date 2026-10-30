<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ValidationRule extends Model
{
    use HasUuids;

    protected $fillable = ['assessment_version_id', 'rules'];

    protected function casts(): array
    {
        return ['rules' => 'array'];
    }
}
