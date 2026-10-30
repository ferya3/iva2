<?php

namespace App\Models;

use App\Domain\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Append-only (DB trigger). tenant_id is nullable for platform actions. */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['tenant_id', 'actor_id', 'action', 'subject_type', 'subject_id', 'ip', 'user_agent', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $q) {
            $ctx = app(TenantContext::class);
            if (! $ctx->isSystem()) {
                $q->where('tenant_id', $ctx->id());
            }
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
