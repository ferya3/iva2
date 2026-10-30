import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_CPT_PROTOCOL } from '@cognitest/assessment-engine';
import { OutboxSink } from '@cognitest/event-recorder';
import type { EventBatch, SessionEvent } from '@cognitest/shared-types';
import { eventBatchSchema } from '@cognitest/validation';
import { createHarness, runToEnd } from '../../../packages/assessment-engine/tests/helpers';
import { PlayerApiClient } from '../electron/api-client';
import { PayloadCipher } from '../electron/payload-cipher';
import { SqliteOutboxStore } from '../electron/sqlite-outbox-store';
import { StateStore } from '../electron/state-store';
import { UploadService } from '../electron/upload-service';
import type { UploadState } from '../electron/ipc-contract';

const SID = randomUUID();

/** Minimal HTTP fake of the Laravel player API with the same ingest rules. */
function fakeServer() {
  const server = {
    online: false,
    status: 'READY',
    stored: [] as SessionEvent[],
    batches: new Map<string, number>(),
    offlineStart: null as unknown,
    completeCalls: 0,
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const fetchImpl = (async (url: string, init: RequestInit) => {
    if (!server.online) throw new TypeError('fetch failed');
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (url.endsWith('/start')) {
      server.offlineStart = body;
      server.status = 'RUNNING';
      return json(200, { seed: body.offline_seed, status: 'RUNNING' });
    }
    if (url.endsWith('/events/batch')) {
      const batch = body as EventBatch;
      expect(eventBatchSchema.safeParse(batch).success).toBe(true);
      if (server.status !== 'RUNNING' && server.status !== 'UPLOADING')
        return json(409, { code: 'session_not_running' });
      const known = server.batches.get(batch.batch_id);
      if (known !== undefined)
        return json(200, {
          batch_id: batch.batch_id,
          accepted: 0,
          duplicate: true,
          last_sequence: known,
        });
      const expected = server.stored.length + 1;
      if (batch.events[0]!.sequence !== expected)
        return json(409, { code: 'sequence_conflict', details: { expected_sequence: expected } });
      server.stored.push(...batch.events);
      server.batches.set(batch.batch_id, server.stored.length);
      return json(201, {
        batch_id: batch.batch_id,
        accepted: batch.events.length,
        duplicate: false,
        last_sequence: server.stored.length,
      });
    }
    if (url.endsWith('/complete')) {
      server.completeCalls++;
      const done = server.stored.length === body.final_sequence;
      server.status = done ? 'COMPLETED' : 'UPLOADING';
      return json(done ? 200 : 202, {
        status: server.status,
        missing_from: done ? null : server.stored.length + 1,
      });
    }
    return json(404, {});
  }) as unknown as typeof fetch;
  return { server, fetchImpl };
}

describe('offline run → later upload', () => {
  it('runs without network, keeps data encrypted on disk and uploads exactly once after reconnecting', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'player-'));
    const key = randomBytes(32);
    const store = new SqliteOutboxStore(
      new DatabaseSync(join(dir, 'outbox.sqlite')),
      new PayloadCipher(key),
    );
    const state = new StateStore(join(dir, 'state.json'), () => 'device-1');
    state.update({
      sessionId: SID,
      offlineStart: { seed: 4242, startedAt: new Date().toISOString(), confirmed: false },
    });

    // 1. The engine records straight into the encrypted SQLite outbox.
    const h = createHarness(DEMO_CPT_PROTOCOL, { seed: 4242, sinks: [new OutboxSink(store, SID)] });
    await runToEnd(h, (s) => (s.is_target ? 400 : null));
    const total = h.recorder.lastSequence;
    expect(store.stats(SID).pendingEvents).toBe(total);

    // 2. Upload attempts while offline only wait; nothing is lost.
    const { server, fetchImpl } = fakeServer();
    const states: UploadState[] = [];
    const makeService = () =>
      new UploadService({
        store: new SqliteOutboxStore(
          new DatabaseSync(join(dir, 'outbox.sqlite')),
          new PayloadCipher(key),
        ),
        api: new PlayerApiClient('https://api.test', fetchImpl),
        state: new StateStore(join(dir, 'state.json'), () => 'unused'),
        engineVersion: '1.0.0',
        emit: (s) => states.push(s),
        onCompleted: () => undefined,
      });
    state.update({ finalSequence: total });
    expect((await makeService().tick()).phase).toBe('waiting');

    // 3. "Restart the app", come back online: offline start is registered,
    //    the stream uploads in order and the session completes.
    server.online = true;
    const service = makeService();
    let last: UploadState = { phase: 'waiting', pending: 0, retryInMs: 0, lastError: '' };
    for (let i = 0; i < 20 && last.phase !== 'completed'; i++) last = await service.tick();

    expect(last.phase).toBe('completed');
    expect(server.offlineStart).toMatchObject({ offline_seed: 4242 });
    expect(server.stored.map((e) => e.sequence)).toEqual(
      Array.from({ length: total }, (_, i) => i + 1),
    );
    expect(server.completeCalls).toBe(1);
    expect(new StateStore(join(dir, 'state.json'), () => 'x').get().completed).toBe(true);
  }, 60_000);
});
