import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/** Non-secret progress of the active session, persisted for crash recovery. */
export interface PlayerState {
  deviceId: string;
  sessionId: string | null;
  /** Set when the run had to start without network. */
  offlineStart: { seed: number; startedAt: string; confirmed: boolean } | null;
  finalSequence: number | null;
  completed: boolean;
}

export class StateStore {
  private state: PlayerState;

  constructor(
    private readonly path: string,
    newDeviceId: () => string,
  ) {
    const fallback: PlayerState = {
      deviceId: newDeviceId(),
      sessionId: null,
      offlineStart: null,
      finalSequence: null,
      completed: false,
    };
    try {
      this.state = existsSync(path)
        ? { ...fallback, ...JSON.parse(readFileSync(path, 'utf8')) }
        : fallback;
    } catch {
      this.state = fallback;
    }
    this.persist();
  }

  get(): Readonly<PlayerState> {
    return this.state;
  }

  update(patch: Partial<PlayerState>): PlayerState {
    this.state = { ...this.state, ...patch };
    this.persist();
    return this.state;
  }

  resetSession(): void {
    this.update({ sessionId: null, offlineStart: null, finalSequence: null, completed: false });
  }

  private persist(): void {
    writeFileSync(`${this.path}.tmp`, JSON.stringify(this.state, null, 2));
    renameSync(`${this.path}.tmp`, this.path);
  }
}
