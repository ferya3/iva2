<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientNote extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'patient_id', 'author_id', 'content'];

    protected function casts(): array
    {
        return ['content' => 'encrypted'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
