<?php

namespace App\Models;

use App\Domain\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ReportAccessLog extends Model
{
    use BelongsToTenant;

    protected $table = 'report_access_logs';

    public $timestamps = false;

    protected $fillable = ['tenant_id', 'report_id', 'user_id', 'action', 'ip', 'accessed_at'];

    protected function casts(): array
    {
        return ['accessed_at' => 'datetime'];
    }
}
