import type { EventPayload, SessionEvent } from '@cognitest/shared-types';
import type { Clock } from '@cognitest/timing-core';

export interface EventSink {
  /** Must persist synchronously (or buffer durably) before returning. */
  write(event: SessionEvent): void;
}

export interface EventRecorderOptions {
  clock: Clock;
  sinks: EventSink[];
  /** Resume numbering after a crash; defaults to 1. */
  firstSequence?: number;
}

/**
 * Append-only recorder. It is the only component that assigns sequence
 * numbers and log timestamps, so the stream is gap-free and ordered by
 * construction. Recorded events are frozen; nothing downstream can mutate
 * the raw record.
 */
export class EventRecorder {
  private nextSequence: number;
  private lastTimestamp = Number.NEGATIVE_INFINITY;
  private sealed = false;

  constructor(private readonly options: EventRecorderOptions) {
    this.nextSequence = options.firstSequence ?? 1;
  }

  record<E extends EventPayload>(payload: E): Readonly<SessionEvent> {
    if (this.sealed) throw new Error('EventRecorder is sealed; the session has ended');
    // Clamp guards against a non-monotonic clock implementation; the
    // production performance clock never triggers it.
    const timestamp = Math.max(this.options.clock.now(), this.lastTimestamp);
    this.lastTimestamp = timestamp;
    const event = Object.freeze({
      ...payload,
      sequence: this.nextSequence++,
      timestamp_ms: timestamp,
    } as SessionEvent);
    for (const sink of this.options.sinks) sink.write(event);
    return event;
  }

  /** Prevents further writes (called after session_ended). */
  seal(): void {
    this.sealed = true;
  }

  get isSealed(): boolean {
    return this.sealed;
  }

  get lastSequence(): number {
    return this.nextSequence - 1;
  }
}

/** Keeps every event in memory; used for live feedback and tests. */
export class MemorySink implements EventSink {
  readonly events: SessionEvent[] = [];

  write(event: SessionEvent): void {
    this.events.push(event);
  }
}
