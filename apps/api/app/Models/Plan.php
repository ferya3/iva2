<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = ['key', 'name', 'price_irr', 'billing_period', 'limits', 'is_active'];

    protected function casts(): array
    {
        return ['limits' => 'array', 'is_active' => 'boolean', 'price_irr' => 'integer'];
    }

    public function limit(string $key): ?int
    {
        $value = $this->limits[$key] ?? null;

        return $value === null ? null : (int) $value;
    }
}
