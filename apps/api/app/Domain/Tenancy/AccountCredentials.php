<?php

namespace App\Domain\Tenancy;

use App\Models\User;
use Illuminate\Support\Str;

/**
 * One-time sign-in details for accounts created or reset by an administrator.
 * The plain password is only ever returned in the API response that created
 * it; the database keeps the hash.
 */
final class AccountCredentials
{
    public static function generatePassword(): string
    {
        return Str::password(12, symbols: false);
    }

    /** Sets a fresh temporary password and signs the user out everywhere. */
    public static function reset(User $user): string
    {
        $password = self::generatePassword();
        $user->forceFill(['password' => $password])->save();
        $user->tokens()->delete();

        return $password;
    }

    public static function loginUrl(): string
    {
        return rtrim((string) config('cognitest.clinic_web_url'), '/').'/login';
    }

    /** @return array{name: string, email: string, password: string, login_url: string} */
    public static function payload(User $user, string $password): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'password' => $password,
            'login_url' => self::loginUrl(),
        ];
    }
}
