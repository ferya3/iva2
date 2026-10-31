<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Database\Factories\PatientFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Patient extends Model
{
    /** @use HasFactory<PatientFactory> */
    use BelongsToTenant, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = ['tenant_id', 'patient_code', 'created_by'];

    protected static function booted(): void
    {
        static::creating(function (Patient $p) {
            $p->pseudonym ??= (string) Str::uuid();
        });
    }

    public function profile(): HasOne
    {
        return $this->hasOne(PatientProfile::class);
    }

    public function guardians(): HasMany
    {
        return $this->hasMany(Guardian::class);
    }

    public function consents(): HasMany
    {
        return $this->hasMany(Consent::class);
    }

    /** Active consent to use this patient's anonymised results for research and norm studies. */
    public function researchConsent(): HasOne
    {
        return $this->hasOne(Consent::class)->where('consent_type', 'research')->whereNull('revoked_at')->orderByDesc('accepted_at');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(PatientNote::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TestSession::class);
    }
}
