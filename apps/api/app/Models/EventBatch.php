<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class EventBatch extends Model
{
    use BelongsToTenant;

    protected $table = 'event_batches';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = ['id', 'tenant_id', 'session_id', 'first_sequence', 'last_sequence', 'event_count', 'payload_sha256', 'engine_version', 'status', 'received_at'];

    protected function casts(): array
    {
        return ['received_at' => 'datetime', 'first_sequence' => 'integer', 'last_sequence' => 'integer', 'event_count' => 'integer'];
    }
}
