<?php

namespace App\Models;

use App\Exceptions\ApiException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Reference values for one assessment version. Reports freeze the scores
 * computed from it, so a published set never changes: corrections are a
 * new version of the set.
 */
class NormSet extends Model
{
    use HasUuids;

    protected $fillable = ['assessment_version_id', 'name', 'version', 'status', 'provisional', 'source', 'created_by', 'published_at'];

    protected function casts(): array
    {
        return ['provisional' => 'boolean', 'published_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(function (NormSet $set) {
            if ($set->getOriginal('status') !== 'draft' && array_diff(array_keys($set->getDirty()), ['status', 'updated_at']) !== []) {
                throw new ApiException('Published norm sets are immutable; create a new version.', 'norm_set_immutable', 409);
            }
        });
    }

    public function scopePublished(Builder $q): Builder
    {
        return $q->where('status', 'published');
    }

    public function assessmentVersion(): BelongsTo
    {
        return $this->belongsTo(AssessmentVersion::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(NormEntry::class);
    }
}
