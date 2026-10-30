<?php

namespace App\Models;

use App\Domain\Tenancy\PlatformRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable, SoftDeletes;

    protected $fillable = ['name', 'email', 'mobile', 'password', 'locale', 'platform_role', 'is_active'];

    protected $hidden = ['password', 'remember_token'];

    protected $attributes = ['platform_role' => null, 'locale' => 'fa', 'is_active' => true];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'platform_role' => PlatformRole::class,
            'is_active' => 'boolean',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(TenantUser::class);
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_users')->withPivot('role', 'status')->withTimestamps();
    }

    public function isPlatformAdmin(): bool
    {
        return $this->platform_role === PlatformRole::SuperAdmin;
    }
}
