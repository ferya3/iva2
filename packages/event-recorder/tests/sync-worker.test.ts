import { describe, expect, it } from 'vitest';
import type { EventBatch } from '@cognitest/shared-types';
import {
  MemoryOutboxStore,
  SyncWorker,
  backoffDelay,
  type BatchTransport,
  type TransportResult,
} from '../src';
import { marker } from '../src/testing';

const SID = '0b5c1b9e-6c1e-4b7a-9b52-6a3e1f2d9c11';

/** Simulated API with the same rules as the Laravel ingest endpoint. */
class FakeServer implements BatchTransport {
  readonly stored: number[] = [];
  readonly seenBatches = new Map<string, number>();
  failures: Array<TransportResult | 'throw'> = [];
  calls = 0;

  async send(batch: EventBatch): Promise<TransportResult> {
    this.calls++;
    const injected = this.failures.shift();
    if (injected === 'throw') throw new Error('ECONNRESET');
    if (injected) return injected;
    const known = this.seenBatches.get(batch.batch_id);
    if (known !== undefined) {
      return {
        kind: 'acked',
        ack: { batch_id: batch.batch_id, accepted: 0, duplicate: true, last_sequence: known },
      };
    }
    const expected = (this.stored.at(-1) ?? 0) + 1;
    if (batch.events[0]!.sequence !== expected)
      return { kind: 'sequence_conflict', expectedSequence: expected };
    for (const e of batch.events) this.stored.push(e.sequence);
    const last = batch.events.at(-1)!.sequence;
    this.seenBatches.set(batch.batch_id, last);
    return {
      kind: 'acked',
      ack: {
        batch_id: batch.batch_id,
        accepted: batch.events.length,
        duplicate: false,
        last_sequence: last,
      },
    };
  }
}

function setup(n: number) {
  const store = new MemoryOutboxStore();
  for (let i = 1; i <= n; i++) store.append(SID, marker(i));
  const server = new FakeServer();
  const sleeps: number[] = [];
  const worker = new SyncWorker({
    store,
    transport: server,
    sessionId: SID,
    engineVersion: '1.0.0',
    maxBatchEvents: 4,
    random: () => 0.5,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { store, server, worker, sleeps };
}

describe('SyncWorker', () => {
  it('drains the outbox in order', async () => {
    const { store, server, worker } = setup(10);
    expect(await worker.flush()).toEqual({ status: 'idle' });
    expect(server.stored).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(store.stats(SID).pendingEvents).toBe(0);
  });

  it('retries network failures with backoff and never duplicates', async () => {
    const { server, worker, sleeps } = setup(6);
    server.failures = ['throw', { kind: 'retryable', error: '503' }];
    await worker.flush();
    expect(server.stored).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('re-sends the same batch id when the ack was lost', async () => {
    const { store, server, worker } = setup(3);
    const batch = store.nextBatch(SID, 4)!;
    // Server stores the batch but the response never reaches the client.
    await server.send({
      session_id: SID,
      batch_id: batch.batchId,
      engine_version: '1.0.0',
      events: batch.events,
    });
    await worker.flush();
    expect(server.stored).toEqual([1, 2, 3]);
    expect(store.stats(SID).lastAckedSequence).toBe(3);
  });

  it('recovers when the server already holds part of the stream', async () => {
    const { store, server, worker } = setup(6);
    server.stored.push(1, 2); // e.g. stored via another, lost batch
    await worker.flush();
    expect(server.stored).toEqual([1, 2, 3, 4, 5, 6]);
    expect(store.stats(SID).pendingEvents).toBe(0);
  });

  it('stops on permanent rejection', async () => {
    const { store, server, worker } = setup(3);
    server.failures = [{ kind: 'rejected', status: 422, message: 'invalid payload' }];
    const state = await worker.flush();
    expect(state.status).toBe('failed');
    expect(store.stats(SID).failed).toBe(true);
  });

  it('returns without sleeping when retry is disabled', async () => {
    const { server, worker, sleeps } = setup(2);
    server.failures = ['throw'];
    expect((await worker.flush({ retry: false })).status).toBe('waiting');
    expect(sleeps).toEqual([]);
  });

  it('caps backoff', () => {
    const opts = { initialMs: 1000, maxMs: 60_000, factor: 2 };
    expect(backoffDelay(20, opts, () => 0.999999)).toBeLessThan(60_000);
  });
});
