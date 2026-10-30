<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Identifying data, stored apart from test data. Sensitive columns are encrypted. */
class PatientProfile extends Model
{
    use BelongsToTenant;

    protected $primaryKey = 'patient_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'patient_id', 'tenant_id', 'first_name', 'last_name', 'national_id', 'birth_date',
        'sex', 'handedness', 'education', 'phone', 'metadata',
    ];

    protected $hidden = ['national_id_hash'];

    protected function casts(): array
    {
        return [
            'national_id' => 'encrypted',
            'phone' => 'encrypted',
            'birth_date' => 'date:Y-m-d',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (PatientProfile $p) {
            if ($p->isDirty('national_id')) {
                $p->national_id_hash = $p->national_id ? self::blindIndex($p->national_id) : null;
            }
        });
    }

    /** Keyed hash for exact-match lookup without decrypting every row. */
    public static function blindIndex(string $value): string
    {
        return hash_hmac('sha256', preg_replace('/\D/', '', $value), config('app.key'));
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function ageYears(?\DateTimeInterface $at = null): ?int
    {
        return $this->birth_date ? (int) floor(abs($this->birth_date->diffInYears($at ?? now()))) : null;
    }
}
