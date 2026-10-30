import type { SessionEvent } from '@cognitest/shared-types';
import type { EventSink } from './event-recorder';

export interface OutboxBatch {
  batchId: string;
  sessionId: string;
  events: SessionEvent[];
  attempts: number;
}

export interface OutboxStats {
  pendingEvents: number;
  pendingBatches: number;
  lastAckedSequence: number;
  lastRecordedSequence: number;
  failed: boolean;
}

/**
 * Durable local queue between the recorder and the API. A batch, once
 * sealed, keeps its id and contents forever so that a retry after a lost
 * response is recognised by the server as the same batch (idempotency).
 */
export interface OutboxStore {
  append(sessionId: string, event: SessionEvent): void;
  /**
   * Returns the oldest sealed, un-acked batch; seals a new one from pending
   * events when none exists. Returns null when nothing is pending.
   */
  nextBatch(sessionId: string, maxEvents: number): OutboxBatch | null;
  /** Records a failed delivery attempt for diagnostics. */
  recordAttempt(sessionId: string, batchId: string, error: string | null): void;
  /**
   * Drops every event with sequence <= `sequence` and dissolves batches that
   * contained them (remaining events are re-batched with fresh ids).
   */
  ackThrough(sessionId: string, sequence: number): void;
  /** Permanent failure: the server rejected the data (needs operator attention). */
  markFailed(sessionId: string, reason: string): void;
  stats(sessionId: string): OutboxStats;
}

export type IdFactory = () => string;

export const defaultIdFactory: IdFactory = () => globalThis.crypto.randomUUID();

interface MemorySession {
  events: SessionEvent[];
  batch: OutboxBatch | null;
  lastAcked: number;
  lastRecorded: number;
  failure: string | null;
}

/** Reference implementation; the desktop player ships an SQLite one. */
export class MemoryOutboxStore implements OutboxStore {
  private readonly sessions = new Map<string, MemorySession>();

  constructor(private readonly newId: IdFactory = defaultIdFactory) {}

  private session(id: string): MemorySession {
    let s = this.sessions.get(id);
    if (!s) {
      s = { events: [], batch: null, lastAcked: 0, lastRecorded: 0, failure: null };
      this.sessions.set(id, s);
    }
    return s;
  }

  append(sessionId: string, event: SessionEvent): void {
    const s = this.session(sessionId);
    if (event.sequence !== s.lastRecorded + 1) {
      throw new Error(`outbox expected sequence ${s.lastRecorded + 1}, got ${event.sequence}`);
    }
    s.events.push(event);
    s.lastRecorded = event.sequence;
  }

  nextBatch(sessionId: string, maxEvents: number): OutboxBatch | null {
    const s = this.session(sessionId);
    if (s.failure) return null;
    if (s.batch) return { ...s.batch, events: [...s.batch.events] };
    if (s.events.length === 0) return null;
    s.batch = {
      batchId: this.newId(),
      sessionId,
      events: s.events.slice(0, maxEvents),
      attempts: 0,
    };
    return { ...s.batch, events: [...s.batch.events] };
  }

  recordAttempt(sessionId: string, batchId: string): void {
    const s = this.session(sessionId);
    if (s.batch?.batchId === batchId) s.batch.attempts++;
  }

  ackThrough(sessionId: string, sequence: number): void {
    const s = this.session(sessionId);
    s.events = s.events.filter((e) => e.sequence > sequence);
    s.lastAcked = Math.max(s.lastAcked, sequence);
    if (s.batch && s.batch.events.some((e) => e.sequence <= sequence)) s.batch = null;
  }

  markFailed(sessionId: string, reason: string): void {
    this.session(sessionId).failure = reason;
  }

  stats(sessionId: string): OutboxStats {
    const s = this.session(sessionId);
    return {
      pendingEvents: s.events.length,
      pendingBatches: s.batch ? 1 : 0,
      lastAckedSequence: s.lastAcked,
      lastRecordedSequence: s.lastRecorded,
      failed: s.failure !== null,
    };
  }
}

/** Adapts an OutboxStore to the recorder's sink interface. */
export class OutboxSink implements EventSink {
  constructor(
    private readonly store: OutboxStore,
    private readonly sessionId: string,
  ) {}

  write(event: SessionEvent): void {
    this.store.append(this.sessionId, event);
  }
}
