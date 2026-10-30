<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use BelongsToTenant, HasUuids;

    protected $fillable = ['tenant_id', 'plan_id', 'status', 'starts_at', 'ends_at'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function isCurrent(): bool
    {
        return in_array($this->status, ['active', 'trialing'], true)
            && $this->starts_at->isPast()
            && ($this->ends_at === null || $this->ends_at->isFuture());
    }
}
