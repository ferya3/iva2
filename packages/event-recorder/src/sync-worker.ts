import type { EventBatch, EventBatchAck } from '@cognitest/shared-types';
import { EVENT_BATCH_LIMITS } from '@cognitest/validation';
import type { OutboxStore } from './outbox';

export type TransportResult =
  | { kind: 'acked'; ack: EventBatchAck }
  /** The server holds a different prefix of the stream (HTTP 409). */
  | { kind: 'sequence_conflict'; expectedSequence: number }
  /** Permanent rejection (HTTP 4xx other than 409/429). */
  | { kind: 'rejected'; status: number; message: string }
  /** Network failure, timeout, 429 or 5xx. */
  | { kind: 'retryable'; error: string; retryAfterMs?: number };

export interface BatchTransport {
  send(batch: EventBatch): Promise<TransportResult>;
}

export interface BackoffOptions {
  initialMs: number;
  maxMs: number;
  factor: number;
}

export type SyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'waiting'; retryInMs: number; attempt: number; lastError: string }
  | { status: 'failed'; reason: string };

export interface SyncWorkerOptions {
  store: OutboxStore;
  transport: BatchTransport;
  sessionId: string;
  engineVersion: string;
  maxBatchEvents?: number;
  backoff?: Partial<BackoffOptions>;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onState?: (state: SyncState) => void;
}

const DEFAULT_BACKOFF: BackoffOptions = { initialMs: 1_000, maxMs: 60_000, factor: 2 };

/** "Full jitter" exponential backoff (AWS architecture blog). */
export function backoffDelay(attempt: number, opts: BackoffOptions, random: () => number): number {
  const cap = Math.min(opts.maxMs, opts.initialMs * opts.factor ** attempt);
  return Math.floor(random() * cap);
}

/**
 * Drains the outbox to the API. Safe to call repeatedly: delivery is
 * at-least-once and the server de-duplicates by batch_id, so the combined
 * behaviour is exactly-once storage.
 */
export class SyncWorker {
  private readonly backoff: BackoffOptions;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private running: Promise<SyncState> | null = null;
  private stopped = false;

  constructor(private readonly options: SyncWorkerOptions) {
    this.backoff = { ...DEFAULT_BACKOFF, ...options.backoff };
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = options.random ?? Math.random;
  }

  /** Stops retrying after the current attempt. */
  stop(): void {
    this.stopped = true;
  }

  /**
   * Sends every pending batch. With `retry`, network errors are retried with
   * backoff until the outbox is empty or stop() is called.
   */
  flush({ retry = true }: { retry?: boolean } = {}): Promise<SyncState> {
    this.stopped = false;
    this.running ??= this.drain(retry).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private emit(state: SyncState): SyncState {
    this.options.onState?.(state);
    return state;
  }

  private async drain(retry: boolean): Promise<SyncState> {
    const { store, sessionId, transport } = this.options;
    const max = Math.min(this.options.maxBatchEvents ?? 200, EVENT_BATCH_LIMITS.maxEvents);
    let attempt = 0;
    this.emit({ status: 'syncing' });

    for (;;) {
      const batch = store.nextBatch(sessionId, max);
      if (!batch) {
        const stats = store.stats(sessionId);
        return this.emit(stats.failed ? { status: 'failed', reason: 'outbox failed' } : { status: 'idle' });
      }

      let result: TransportResult;
      try {
        result = await transport.send({
          session_id: sessionId,
          batch_id: batch.batchId,
          engine_version: this.options.engineVersion,
          events: batch.events,
        });
      } catch (error) {
        result = { kind: 'retryable', error: error instanceof Error ? error.message : String(error) };
      }

      switch (result.kind) {
        case 'acked':
          store.ackThrough(sessionId, result.ack.last_sequence);
          attempt = 0;
          break;
        case 'sequence_conflict':
          if (result.expectedSequence > batch.events[0]!.sequence) {
            // Server already holds part of this range (e.g. response was lost
            // after a partial re-batch): drop what it has and continue.
            store.ackThrough(sessionId, result.expectedSequence - 1);
            break;
          }
          store.markFailed(sessionId, `server expects sequence ${result.expectedSequence}`);
          return this.emit({ status: 'failed', reason: `sequence gap before ${batch.events[0]!.sequence}` });
        case 'rejected':
          store.recordAttempt(sessionId, batch.batchId, result.message);
          store.markFailed(sessionId, result.message);
          return this.emit({ status: 'failed', reason: `${result.status}: ${result.message}` });
        case 'retryable': {
          store.recordAttempt(sessionId, batch.batchId, result.error);
          if (!retry || this.stopped) {
            return this.emit({ status: 'waiting', retryInMs: 0, attempt, lastError: result.error });
          }
          const delay = Math.max(result.retryAfterMs ?? 0, backoffDelay(attempt, this.backoff, this.random));
          attempt++;
          this.emit({ status: 'waiting', retryInMs: delay, attempt, lastError: result.error });
          await this.sleep(delay);
          if (this.stopped) {
            return this.emit({ status: 'waiting', retryInMs: 0, attempt, lastError: result.error });
          }
          this.emit({ status: 'syncing' });
          break;
        }
      }
    }
  }
}
