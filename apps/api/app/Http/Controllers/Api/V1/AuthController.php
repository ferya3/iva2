<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:64'],
        ]);

        $key = 'login:'.Str::lower($data['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw new ApiException('Too many login attempts. Try again later.', 'too_many_attempts', 429, [
                'retry_after' => RateLimiter::availableIn($key),
            ]);
        }

        $user = User::query()->where('email', Str::lower($data['email']))->first();
        if (! $user || ! $user->is_active || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw new ApiException('Invalid credentials.', 'invalid_credentials', 422);
        }
        RateLimiter::clear($key);

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken($data['device_name'] ?? 'web', ['*'], now()->addMinutes((int) config('sanctum.expiration')));

        return response()->json([
            'token' => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at?->toIso8601String(),
            'user' => new UserResource($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $memberships = $user->memberships()->with('tenant')->where('status', 'active')->get()
            ->filter(fn ($m) => $m->tenant !== null);

        return response()->json([
            'user' => new UserResource($user),
            'memberships' => MembershipResource::collection($memberships->values()),
        ]);
    }

    /** Rotates the bearer token (old one is revoked). */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $current = $user->currentAccessToken();
        $token = $user->createToken($current->name ?? 'web', $current->abilities ?? ['*'], now()->addMinutes((int) config('sanctum.expiration')));
        $current->delete();

        return response()->json([
            'token' => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at?->toIso8601String(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
