<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mean/SD of one metric for one age band (and sex) of the reference sample. */
class NormEntry extends Model
{
    public $timestamps = false;

    protected $fillable = ['norm_set_id', 'scope', 'metric_key', 'sex', 'age_min_years', 'age_max_years', 'mean', 'sd', 'n', 'direction'];

    protected function casts(): array
    {
        return [
            'age_min_years' => 'integer',
            'age_max_years' => 'integer',
            'mean' => 'float',
            'sd' => 'float',
            'n' => 'integer',
        ];
    }

    public function normSet(): BelongsTo
    {
        return $this->belongsTo(NormSet::class);
    }
}
