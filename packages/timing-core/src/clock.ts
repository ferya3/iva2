/**
 * A monotonic millisecond clock. Every timestamp the engine records comes
 * from one Clock instance so that stimulus and response times share a
 * single timebase (in browsers/Electron: the document's performance timeline,
 * which is also the timebase of Event.timeStamp and rAF timestamps).
 */
export interface Clock {
  now(): number;
}

/** Wraps performance.now(); the production clock. */
export class PerformanceClock implements Clock {
  constructor(private readonly perf: Pick<Performance, 'now'> = globalThis.performance) {}

  now(): number {
    return this.perf.now();
  }
}

/**
 * A clock re-based to an origin, so session timestamps start at ~0 and stay
 * well inside double precision for the whole session.
 */
export class OffsetClock implements Clock {
  readonly origin: number;

  constructor(
    private readonly source: Clock,
    origin?: number,
  ) {
    this.origin = origin ?? source.now();
  }

  now(): number {
    return this.source.now() - this.origin;
  }

  /** Converts a timestamp of the source timebase (e.g. Event.timeStamp). */
  fromSource(sourceTime: number): number {
    return sourceTime - this.origin;
  }
}

/** Deterministic clock for tests and offline replay. */
export class ManualClock implements Clock {
  constructor(private current = 0) {}

  now(): number {
    return this.current;
  }

  set(time: number): void {
    if (time < this.current) throw new Error('ManualClock cannot go backwards');
    this.current = time;
  }

  advance(ms: number): void {
    this.set(this.current + ms);
  }
}
