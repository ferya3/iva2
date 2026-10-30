<?php

namespace App\Models;

use App\Exceptions\ApiException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Immutable once published: definition rows are protected by DB triggers,
 * and this model refuses to change anything but status/published_at.
 */
class AssessmentVersion extends Model
{
    use HasUuids;

    protected $fillable = ['assessment_type_id', 'version', 'status', 'is_clinical', 'estimated_duration_seconds', 'min_engine_version', 'published_at'];

    protected function casts(): array
    {
        return ['is_clinical' => 'boolean', 'published_at' => 'datetime', 'estimated_duration_seconds' => 'integer'];
    }

    protected static function booted(): void
    {
        static::updating(function (AssessmentVersion $v) {
            if ($v->getOriginal('status') !== 'draft') {
                $changed = array_diff(array_keys($v->getDirty()), ['status', 'updated_at']);
                if ($changed !== []) {
                    throw new ApiException('Published assessment versions are immutable; create a new version.', 'assessment_version_immutable', 409);
                }
            }
        });
    }

    public function scopePublished(Builder $q): Builder
    {
        return $q->where('status', 'published');
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(AssessmentType::class, 'assessment_type_id');
    }

    public function protocol(): HasOne
    {
        return $this->hasOne(AssessmentProtocol::class);
    }

    public function validationRules(): HasOne
    {
        return $this->hasOne(ValidationRule::class);
    }

    public function scoringVersions(): HasMany
    {
        return $this->hasMany(ScoringVersion::class);
    }

    public function defaultScoringVersion(): HasOne
    {
        return $this->hasOne(ScoringVersion::class)->where('is_default', true);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(StimulusAsset::class);
    }
}
