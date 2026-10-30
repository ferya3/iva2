import { SyncWorker, type SyncState } from '@cognitest/event-recorder';
import { ApiFailure, type PlayerApiClient } from './api-client';
import type { UploadState } from './ipc-contract';
import type { SqliteOutboxStore } from './sqlite-outbox-store';
import type { StateStore } from './state-store';

export interface UploadServiceDeps {
  store: SqliteOutboxStore;
  api: PlayerApiClient;
  state: StateStore;
  engineVersion: string;
  emit(state: UploadState): void;
  /** Called once the server confirmed completion (clear credentials). */
  onCompleted(sessionId: string): void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/**
 * Background uploader. While a session runs it streams batches every few
 * seconds; after the run it drains the outbox and confirms completion.
 * Network loss only delays this — data stays encrypted on disk and the
 * service resumes after reconnection or an application restart.
 */
export class UploadService {
  private timer: unknown = null;
  private busy = false;
  private failures = 0;
  private stopped = false;

  constructor(private readonly d: UploadServiceDeps) {}

  /** Starts the periodic loop (idempotent). */
  start(intervalMs = 4_000): void {
    this.stopped = false;
    const loop = async () => {
      if (this.stopped) return;
      const state = await this.tick();
      const delay =
        state.phase === 'waiting'
          ? Math.min(60_000, 2_000 * 2 ** Math.min(this.failures, 5))
          : intervalMs;
      if (state.phase !== 'completed' && state.phase !== 'failed') this.schedule(loop, delay);
    };
    this.schedule(loop, 0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null)
      (this.d.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }

  private schedule(fn: () => void, ms: number): void {
    if (this.timer !== null)
      (this.d.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = (this.d.setTimer ?? setTimeout)(fn, ms);
  }

  /** One synchronisation pass. Safe to call at any time. */
  async tick(): Promise<UploadState> {
    const { state, store, api } = this.d;
    const s = state.get();
    if (!s.sessionId) return { phase: 'completed' };
    if (s.completed) return this.publish({ phase: 'completed' });
    if (this.busy) return this.snapshot();
    this.busy = true;
    try {
      // 1. A run started offline must be registered before events are accepted.
      if (s.offlineStart && !s.offlineStart.confirmed) {
        await api.start(s.sessionId, {
          seed: s.offlineStart.seed,
          startedAt: s.offlineStart.startedAt,
        });
        state.update({ offlineStart: { ...s.offlineStart, confirmed: true } });
      }

      // 2. Drain whatever is in the outbox (no internal sleeping: the loop backs off).
      let syncState: SyncState = { status: 'idle' };
      if (store.stats(s.sessionId).pendingEvents > 0) {
        syncState = await new SyncWorker({
          store,
          transport: api,
          sessionId: s.sessionId,
          engineVersion: this.d.engineVersion,
        }).flush({ retry: false });
      }
      if (syncState.status === 'failed')
        return this.publish({ phase: 'failed', reason: syncState.reason });
      if (syncState.status === 'waiting') {
        this.failures++;
        return this.publish({
          phase: 'waiting',
          pending: store.stats(s.sessionId).pendingEvents,
          retryInMs: 0,
          lastError: syncState.lastError,
        });
      }

      // 3. Everything uploaded and the run is over → confirm completion.
      const fresh = state.get();
      if (fresh.finalSequence !== null && store.stats(s.sessionId).pendingEvents === 0) {
        const res = await api.complete(s.sessionId, fresh.finalSequence);
        if (
          res.status === 'COMPLETED' ||
          res.status === 'VALIDATED' ||
          res.status === 'INVALID' ||
          res.status === 'REPORTED'
        ) {
          state.update({ completed: true });
          store.forget(s.sessionId);
          this.d.onCompleted(s.sessionId);
          this.failures = 0;
          return this.publish({ phase: 'completed' });
        }
      }
      this.failures = 0;
      return this.publish(this.snapshot());
    } catch (error) {
      if (error instanceof ApiFailure && !error.retryable) {
        return this.publish({
          phase: 'failed',
          reason: `${error.code ?? error.status}: ${error.message}`,
        });
      }
      this.failures++;
      const sid = s.sessionId;
      return this.publish({
        phase: 'waiting',
        pending: store.stats(sid).pendingEvents,
        retryInMs: 0,
        lastError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.busy = false;
    }
  }

  private snapshot(): UploadState {
    const s = this.d.state.get();
    const stats = this.d.store.stats(s.sessionId!);
    return {
      phase: 'syncing',
      pending: stats.pendingEvents,
      lastAcked: stats.lastAckedSequence,
      finalSequence: s.finalSequence,
    };
  }

  private publish(state: UploadState): UploadState {
    this.d.emit(state);
    return state;
  }
}
