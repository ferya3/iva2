import type { DatabaseSync } from 'node:sqlite';
import type { SessionEvent } from '@cognitest/shared-types';
import {
  defaultIdFactory,
  type IdFactory,
  type OutboxBatch,
  type OutboxStats,
  type OutboxStore,
} from '@cognitest/event-recorder';
import type { PayloadCipher } from './payload-cipher';

/**
 * Durable, encrypted outbox on SQLite (node:sqlite — no native module to
 * build for Windows). Every append is committed before the call returns, so
 * a crash or power loss after an event was recorded cannot lose it.
 * Implements the shared OutboxStore contract (tested with the same suite as
 * the in-memory reference implementation).
 */
export class SqliteOutboxStore implements OutboxStore {
  constructor(
    private readonly db: DatabaseSync,
    private readonly cipher: PayloadCipher,
    private readonly newId: IdFactory = defaultIdFactory,
  ) {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS outbox_sessions (
        session_id TEXT PRIMARY KEY,
        last_acked INTEGER NOT NULL DEFAULT 0,
        last_recorded INTEGER NOT NULL DEFAULT 0,
        failure TEXT
      );
      CREATE TABLE IF NOT EXISTS outbox_batches (
        batch_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outbox_events (
        session_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        payload BLOB NOT NULL,
        batch_id TEXT REFERENCES outbox_batches(batch_id) ON DELETE SET NULL,
        PRIMARY KEY (session_id, sequence)
      ) WITHOUT ROWID;
    `);
  }

  private aad(sessionId: string, sequence: number): string {
    return `${sessionId}:${sequence}`;
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  private sessionRow(id: string) {
    this.db.prepare('INSERT OR IGNORE INTO outbox_sessions (session_id) VALUES (?)').run(id);
    return this.db
      .prepare(
        'SELECT last_acked, last_recorded, failure FROM outbox_sessions WHERE session_id = ?',
      )
      .get(id) as {
      last_acked: number;
      last_recorded: number;
      failure: string | null;
    };
  }

  append(sessionId: string, event: SessionEvent): void {
    this.appendMany(sessionId, [event]);
  }

  /** Appends several events in one transaction (one fsync). */
  appendMany(sessionId: string, events: readonly SessionEvent[]): void {
    if (events.length === 0) return;
    this.tx(() => {
      let last = this.sessionRow(sessionId).last_recorded;
      const insert = this.db.prepare(
        'INSERT INTO outbox_events (session_id, sequence, payload) VALUES (?, ?, ?)',
      );
      for (const e of events) {
        if (e.sequence !== last + 1)
          throw new Error(`outbox expected sequence ${last + 1}, got ${e.sequence}`);
        insert.run(
          sessionId,
          e.sequence,
          this.cipher.encrypt(JSON.stringify(e), this.aad(sessionId, e.sequence)),
        );
        last = e.sequence;
      }
      this.db
        .prepare('UPDATE outbox_sessions SET last_recorded = ? WHERE session_id = ?')
        .run(last, sessionId);
    });
  }

  nextBatch(sessionId: string, maxEvents: number): OutboxBatch | null {
    return this.tx(() => {
      if (this.sessionRow(sessionId).failure) return null;
      let batch = this.db
        .prepare(
          'SELECT batch_id, attempts FROM outbox_batches WHERE session_id = ? ORDER BY created_at LIMIT 1',
        )
        .get(sessionId) as { batch_id: string; attempts: number } | undefined;
      if (!batch) {
        const first = this.db
          .prepare('SELECT 1 FROM outbox_events WHERE session_id = ? LIMIT 1')
          .get(sessionId);
        if (!first) return null;
        batch = { batch_id: this.newId(), attempts: 0 };
        this.db
          .prepare('INSERT INTO outbox_batches (batch_id, session_id, created_at) VALUES (?, ?, ?)')
          .run(batch.batch_id, sessionId, new Date().toISOString());
        this.db
          .prepare(
            `UPDATE outbox_events SET batch_id = ? WHERE session_id = ? AND sequence IN (
               SELECT sequence FROM outbox_events WHERE session_id = ? AND batch_id IS NULL ORDER BY sequence LIMIT ?)`,
          )
          .run(batch.batch_id, sessionId, sessionId, maxEvents);
      }
      const rows = this.db
        .prepare('SELECT sequence, payload FROM outbox_events WHERE batch_id = ? ORDER BY sequence')
        .all(batch.batch_id) as Array<{ sequence: number; payload: Uint8Array }>;
      return {
        batchId: batch.batch_id,
        sessionId,
        attempts: batch.attempts,
        events: rows.map(
          (r) =>
            JSON.parse(
              this.cipher.decrypt(r.payload, this.aad(sessionId, r.sequence)),
            ) as SessionEvent,
        ),
      };
    });
  }

  recordAttempt(sessionId: string, batchId: string, error: string | null): void {
    this.db
      .prepare(
        'UPDATE outbox_batches SET attempts = attempts + 1, last_error = ? WHERE batch_id = ? AND session_id = ?',
      )
      .run(error, batchId, sessionId);
  }

  ackThrough(sessionId: string, sequence: number): void {
    this.tx(() => {
      this.sessionRow(sessionId);
      // Dissolve batches that contain acknowledged events (remaining events
      // of a partially acknowledged batch are re-batched with a new id).
      const batches = this.db
        .prepare(
          'SELECT DISTINCT batch_id FROM outbox_events WHERE session_id = ? AND sequence <= ? AND batch_id IS NOT NULL',
        )
        .all(sessionId, sequence) as Array<{ batch_id: string }>;
      for (const b of batches) {
        this.db
          .prepare('UPDATE outbox_events SET batch_id = NULL WHERE batch_id = ?')
          .run(b.batch_id);
        this.db.prepare('DELETE FROM outbox_batches WHERE batch_id = ?').run(b.batch_id);
      }
      this.db
        .prepare('DELETE FROM outbox_events WHERE session_id = ? AND sequence <= ?')
        .run(sessionId, sequence);
      this.db
        .prepare('UPDATE outbox_sessions SET last_acked = MAX(last_acked, ?) WHERE session_id = ?')
        .run(sequence, sessionId);
    });
  }

  markFailed(sessionId: string, reason: string): void {
    this.sessionRow(sessionId);
    this.db
      .prepare('UPDATE outbox_sessions SET failure = ? WHERE session_id = ?')
      .run(reason, sessionId);
  }

  stats(sessionId: string): OutboxStats {
    const s = this.sessionRow(sessionId);
    const pending = this.db
      .prepare('SELECT COUNT(*) AS n FROM outbox_events WHERE session_id = ?')
      .get(sessionId) as { n: number };
    const batches = this.db
      .prepare('SELECT COUNT(*) AS n FROM outbox_batches WHERE session_id = ?')
      .get(sessionId) as { n: number };
    return {
      pendingEvents: Number(pending.n),
      pendingBatches: Number(batches.n),
      lastAckedSequence: s.last_acked,
      lastRecordedSequence: s.last_recorded,
      failed: s.failure !== null,
    };
  }

  /** Sessions that still have events to upload (resume after restart). */
  pendingSessions(): string[] {
    return (
      this.db.prepare('SELECT DISTINCT session_id FROM outbox_events').all() as Array<{
        session_id: string;
      }>
    ).map((r) => r.session_id);
  }

  /** Removes everything about a session once the server confirmed completion. */
  forget(sessionId: string): void {
    this.tx(() => {
      this.db.prepare('DELETE FROM outbox_events WHERE session_id = ?').run(sessionId);
      this.db.prepare('DELETE FROM outbox_batches WHERE session_id = ?').run(sessionId);
      this.db.prepare('DELETE FROM outbox_sessions WHERE session_id = ?').run(sessionId);
    });
  }
}
