<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AssessmentProtocol extends Model
{
    use HasUuids;

    protected $fillable = ['assessment_version_id', 'config', 'config_sha256'];

    protected function casts(): array
    {
        return ['config' => 'array'];
    }

    protected static function booted(): void
    {
        static::saving(function (AssessmentProtocol $p) {
            $p->config_sha256 = hash('sha256', json_encode($p->config, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
        });
    }
}
