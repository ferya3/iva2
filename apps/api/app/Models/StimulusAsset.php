<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class StimulusAsset extends Model
{
    use HasUuids;

    protected $fillable = ['assessment_version_id', 'asset_key', 'disk', 'storage_path', 'mime_type', 'sha256', 'size_bytes'];
}
