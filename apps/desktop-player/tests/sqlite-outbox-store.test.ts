import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { outboxContractTests, marker } from '@cognitest/event-recorder/testing';
import { PayloadCipher } from '../electron/payload-cipher';
import { SqliteOutboxStore } from '../electron/sqlite-outbox-store';

let n = 0;
const newStore = (db = new DatabaseSync(':memory:'), key = randomBytes(32)) =>
  new SqliteOutboxStore(db, new PayloadCipher(key), () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);

outboxContractTests('SqliteOutboxStore', () => newStore());

describe('SqliteOutboxStore specifics', () => {
  it('survives a restart (durable on disk)', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'outbox-')), 'outbox.sqlite');
    const key = randomBytes(32);
    const a = newStore(new DatabaseSync(file), key);
    a.appendMany('s', [marker(1), marker(2), marker(3)]);
    const batch = a.nextBatch('s', 2)!;

    const b = newStore(new DatabaseSync(file), key);
    expect(b.nextBatch('s', 2)!.batchId).toBe(batch.batchId);
    expect(b.stats('s')).toMatchObject({ pendingEvents: 3, lastRecordedSequence: 3 });
    expect(b.pendingSessions()).toEqual(['s']);
  });

  it('stores payloads encrypted', () => {
    const db = new DatabaseSync(':memory:');
    const store = newStore(db);
    store.append('s', { sequence: 1, type: 'marker', timestamp_ms: 1, label: 'secret-label' });
    const row = db.prepare('SELECT payload FROM outbox_events').get() as { payload: Uint8Array };
    expect(Buffer.from(row.payload).toString('latin1')).not.toContain('secret-label');
  });

  it('detects tampering and row swapping', () => {
    const db = new DatabaseSync(':memory:');
    const store = newStore(db);
    store.appendMany('s', [marker(1), marker(2)]);
    db.exec(`UPDATE outbox_events SET payload = (SELECT payload FROM outbox_events WHERE sequence = 2) WHERE sequence = 1`);
    expect(() => store.nextBatch('s', 10)).toThrow();
  });

  it('cannot be read with another key', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'outbox-')), 'outbox.sqlite');
    newStore(new DatabaseSync(file)).append('s', marker(1));
    expect(() => newStore(new DatabaseSync(file)).nextBatch('s', 1)).toThrow();
  });

  it('appends many events atomically', () => {
    const store = newStore();
    store.append('s', marker(1));
    expect(() => store.appendMany('s', [marker(2), marker(4)])).toThrow();
    expect(store.stats('s').lastRecordedSequence).toBe(1);
  });

  it('forgets a completed session', () => {
    const store = newStore();
    store.appendMany('s', [marker(1)]);
    store.forget('s');
    expect(store.pendingSessions()).toEqual([]);
  });
});
