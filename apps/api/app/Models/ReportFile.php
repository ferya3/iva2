<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ReportFile extends Model
{
    use BelongsToTenant, HasUuids;

    protected $table = 'report_files';

    public const UPDATED_AT = null;

    protected $fillable = ['tenant_id', 'report_id', 'disk', 'storage_path', 'mime_type', 'sha256', 'size_bytes'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime', 'size_bytes' => 'integer'];
    }
}
