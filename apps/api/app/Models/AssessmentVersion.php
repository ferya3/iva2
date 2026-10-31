<?php

namespace App\Models;

use App\Domain\Reports\Format;
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

    protected $fillable = ['assessment_type_id', 'version', 'status', 'is_clinical', 'estimated_duration_seconds', 'min_engine_version', 'min_age_years', 'max_age_years', 'audience_label', 'published_at'];

    /** Eligibility metadata that may change after publishing (not part of the protocol). */
    private const MUTABLE_AFTER_PUBLISH = ['status', 'updated_at', 'min_age_years', 'max_age_years', 'audience_label'];

    protected function casts(): array
    {
        return [
            'is_clinical' => 'boolean',
            'published_at' => 'datetime',
            'estimated_duration_seconds' => 'integer',
            'min_age_years' => 'integer',
            'max_age_years' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (AssessmentVersion $v) {
            if ($v->getOriginal('status') !== 'draft') {
                $changed = array_diff(array_keys($v->getDirty()), self::MUTABLE_AFTER_PUBLISH);
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

    /** Published versions whose age range contains $age (an unknown age matches only unrestricted versions). */
    public function scopeForAge(Builder $q, ?int $age): Builder
    {
        if ($age === null) {
            return $q->whereNull('min_age_years')->whereNull('max_age_years');
        }

        return $q->where(fn ($w) => $w->whereNull('min_age_years')->orWhere('min_age_years', '<=', $age))
            ->where(fn ($w) => $w->whereNull('max_age_years')->orWhere('max_age_years', '>=', $age));
    }

    public function coversAge(?int $age): bool
    {
        if ($age === null) {
            return $this->min_age_years === null && $this->max_age_years === null;
        }

        return ($this->min_age_years === null || $age >= $this->min_age_years)
            && ($this->max_age_years === null || $age <= $this->max_age_years);
    }

    /** e.g. "۶–۸ سال", "۹ سال به بالا"; null when unrestricted. */
    public function ageRangeLabel(): ?string
    {
        [$min, $max] = [Format::digits($this->min_age_years), Format::digits($this->max_age_years)];

        return match (true) {
            $this->min_age_years !== null && $this->max_age_years !== null => "{$min}–{$max} سال",
            $this->min_age_years !== null => "{$min} سال به بالا",
            $this->max_age_years !== null => "تا {$max} سال",
            default => null,
        };
    }

    public function normSets(): HasMany
    {
        return $this->hasMany(NormSet::class);
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
