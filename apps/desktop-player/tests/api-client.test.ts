import { describe, expect, it } from 'vitest';
import { ApiFailure, PlayerApiClient } from '../electron/api-client';

const batch = { session_id: 's', batch_id: 'b', engine_version: '1.0.0', events: [] };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

describe('PlayerApiClient', () => {
  it('sends the bearer token and JSON', async () => {
    let seen: RequestInit | undefined;
    const client = new PlayerApiClient('https://api.test', (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ status: 'DEVICE_CHECK' }), { status: 200 });
    }) as unknown as typeof fetch);
    client.setToken('tok');
    await client.deviceCheck('sid', { os: 'Windows' });
    expect((seen?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(seen?.body).toBe('{"os":"Windows"}');
  });

  it('maps batch outcomes for the sync worker', async () => {
    const ack = { batch_id: 'b', accepted: 1, duplicate: false, last_sequence: 1 };
    expect(await new PlayerApiClient('x', reply(201, ack)).send(batch)).toEqual({ kind: 'acked', ack });
    expect(await new PlayerApiClient('x', reply(409, { code: 'sequence_conflict', details: { expected_sequence: 7 } })).send(batch)).toEqual({
      kind: 'sequence_conflict',
      expectedSequence: 7,
    });
    expect((await new PlayerApiClient('x', reply(503, { message: 'down' })).send(batch)).kind).toBe('retryable');
    expect(await new PlayerApiClient('x', reply(429, { message: 'slow' }, { 'Retry-After': '30' })).send(batch)).toMatchObject({
      kind: 'retryable',
      retryAfterMs: 30_000,
    });
    expect((await new PlayerApiClient('x', reply(422, { code: 'invalid', message: 'bad' })).send(batch)).kind).toBe('rejected');
    expect((await new PlayerApiClient('x', reply(409, { code: 'session_not_running' })).send(batch)).kind).toBe('rejected');
  });

  it('treats connection errors and timeouts as retryable network failures', async () => {
    const down = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect((await new PlayerApiClient('x', down).send(batch)).kind).toBe('retryable');
    const err = await new PlayerApiClient('x', down).join('ABC-DEF-GHJ', 'dev').catch((e) => e);
    expect(err).toBeInstanceOf(ApiFailure);
    expect(err.kind).toBe('network');
  });
});
