<?php

namespace App\Models;

use App\Domain\Sessions\SessionStatus;
use App\Domain\Tenancy\BelongsToTenant;
use Database\Factories\TestSessionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TestSession extends Model
{
    /** @use HasFactory<TestSessionFactory> */
    use BelongsToTenant, HasFactory, HasUuids;

    protected $fillable = ['tenant_id', 'patient_id', 'assessment_version_id', 'created_by', 'notes'];

    protected $attributes = ['status' => 'CREATED', 'last_sequence' => 0];

    protected function casts(): array
    {
        return [
            'status' => SessionStatus::class,
            'seed' => 'integer',
            'last_sequence' => 'integer',
            'expected_final_sequence' => 'integer',
            'invited_at' => 'datetime',
            'expires_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function assessmentVersion(): BelongsTo
    {
        return $this->belongsTo(AssessmentVersion::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tokens(): HasMany
    {
        return $this->hasMany(SessionToken::class, 'session_id');
    }

    public function states(): HasMany
    {
        return $this->hasMany(SessionState::class, 'session_id');
    }

    public function calibrations(): HasMany
    {
        return $this->hasMany(CalibrationResult::class, 'session_id');
    }

    public function latestCalibration(): HasOne
    {
        // UUID keys have no MAX(), so latestOfMany() cannot be used on PostgreSQL.
        return $this->hasOne(CalibrationResult::class, 'session_id')->orderByDesc('created_at')->orderByDesc('id');
    }

    public function deviceProfile(): HasOne
    {
        return $this->hasOne(DeviceProfile::class, 'session_id')->orderByDesc('created_at')->orderByDesc('id');
    }

    public function scoringRuns(): HasMany
    {
        return $this->hasMany(ScoringRun::class, 'session_id');
    }

    public function latestSucceededRun(): HasOne
    {
        return $this->hasOne(ScoringRun::class, 'session_id')->where('status', 'succeeded')->orderByDesc('created_at')->orderByDesc('id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'session_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(EventBatch::class, 'session_id');
    }
}
