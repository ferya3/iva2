<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssessmentType extends Model
{
    use HasUuids;

    protected $fillable = ['key', 'name', 'name_en', 'category', 'description'];

    public function versions(): HasMany
    {
        return $this->hasMany(AssessmentVersion::class);
    }
}
