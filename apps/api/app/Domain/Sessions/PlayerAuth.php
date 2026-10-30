<?php

namespace App\Domain\Sessions;

use App\Domain\Tenancy\TenantContext;
use App\Exceptions\ApiException;
use App\Models\SessionToken;
use App\Models\TestSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Credentials of the desktop player.
 *
 * 1. The clinician creates an invite: a short human-typable code (shown
 *    once, stored as an HMAC) that the participant enters in the player.
 * 2. Joining exchanges the code for a per-session access token bound to one
 *    device. Only hashes are stored; leaked database rows grant nothing.
 * 3. Starting the test revokes the invite, so a code cannot be reused to
 *    re-run a session.
 */
final class PlayerAuth
{
    /** Unambiguous alphabet: no 0/O, 1/I/L. */
    private const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    public function __construct(
        private readonly TenantContext $context,
        private readonly SessionStateMachine $states,
    ) {}

    /** @return array{code: string, expires_at: CarbonImmutable} */
    public function createInvite(TestSession $session, User $by): array
    {
        if (! in_array($session->status, [SessionStatus::Created, SessionStatus::Invited], true)) {
            throw new ApiException('Invites can only be issued before the device check.', 'invite_not_allowed', 409);
        }

        $code = $this->generateCode();
        $expires = CarbonImmutable::now()->addHours(config('cognitest.invites.ttl_hours'));

        DB::transaction(function () use ($session, $by, $code, $expires) {
            $session->tokens()->where('kind', 'invite')->whereNull('revoked_at')->update(['revoked_at' => now()]);
            SessionToken::create([
                'tenant_id' => $session->tenant_id,
                'session_id' => $session->id,
                'kind' => 'invite',
                'token_hash' => $this->hash($this->normalize($code)),
                'expires_at' => $expires,
            ]);
            if ($session->status === SessionStatus::Created) {
                $this->states->transition($session, SessionStatus::Invited, 'user', $by->id, null, [
                    'invited_at' => now(),
                    'expires_at' => $expires,
                ]);
            } else {
                $session->forceFill(['expires_at' => $expires])->save();
            }
        });

        return ['code' => $code, 'expires_at' => $expires];
    }

    /** @return array{session: TestSession, token: string, expires_at: CarbonImmutable} */
    public function join(string $code, string $deviceId, ?string $ip): array
    {
        $invite = $this->context->runAsSystem(fn () => SessionToken::query()
            ->with('session.tenant')
            ->where('kind', 'invite')
            ->where('token_hash', $this->hash($this->normalize($code)))
            ->first());

        if (! $invite || ! $invite->isUsable() || ! $invite->session?->tenant?->isActive()) {
            throw new ApiException('The code is invalid or has expired.', 'invalid_invite', 422);
        }
        $session = $invite->session;
        if (! $session->status->isJoinable()) {
            throw new ApiException('This session can no longer be joined.', 'session_not_joinable', 409, ['status' => $session->status->value]);
        }

        return $this->context->runAs($session->tenant, function () use ($session, $invite, $deviceId, $ip) {
            $token = Str::random(64);
            $expires = CarbonImmutable::now()->addHours(config('cognitest.invites.player_token_ttl_hours'));
            DB::transaction(function () use ($session, $invite, $deviceId, $ip, $token, $expires) {
                $session->tokens()->where('kind', 'access')->whereNull('revoked_at')->update(['revoked_at' => now()]);
                SessionToken::create([
                    'tenant_id' => $session->tenant_id,
                    'session_id' => $session->id,
                    'kind' => 'access',
                    'token_hash' => $this->hash($token),
                    'expires_at' => $expires,
                    'device_id' => $deviceId,
                    'ip' => $ip,
                ]);
                $invite->forceFill(['used_at' => now()])->save();
            });

            return ['session' => $session, 'token' => $token, 'expires_at' => $expires];
        });
    }

    public function resolveAccessToken(string $token): TestSession
    {
        $access = $this->context->runAsSystem(fn () => SessionToken::query()
            ->with('session.tenant')
            ->where('kind', 'access')
            ->where('token_hash', $this->hash($token))
            ->first());

        if (! $access || ! $access->isUsable() || ! $access->session?->tenant?->isActive()) {
            throw new ApiException('Player token is invalid or expired.', 'player_unauthenticated', 401);
        }

        return $access->session;
    }

    public function revokeInvites(TestSession $session): void
    {
        $session->tokens()->where('kind', 'invite')->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    public function revokeAll(TestSession $session): void
    {
        $session->tokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    private function generateCode(): string
    {
        $chars = '';
        for ($i = 0; $i < 9; $i++) {
            $chars .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return implode('-', str_split($chars, 3));
    }

    private function normalize(string $code): string
    {
        return strtoupper(preg_replace('/[^0-9A-Za-z]/', '', $code));
    }

    private function hash(string $value): string
    {
        return hash_hmac('sha256', $value, config('app.key'));
    }
}
