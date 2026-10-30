<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionToken extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'session_id', 'kind', 'token_hash', 'expires_at', 'used_at', 'revoked_at', 'device_id', 'ip'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TestSession::class, 'session_id');
    }

    public function isUsable(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }
}
