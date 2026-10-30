/**
 * Headless harness: a virtual display that emits vsync-aligned frames on a
 * manual clock, plus scriptable input. Lets the full engine run in
 * milliseconds of wall time with exact, reproducible timing.
 */
import { ManualClock, OffsetClock } from '@cognitest/timing-core';
import type {
  EnvironmentSignal,
  EnvironmentSource,
  FrameSource,
  InputSource,
  RawInput,
} from './ports';

export class VirtualDisplay implements FrameSource {
  readonly clock = new ManualClock(10_000);
  readonly session = new OffsetClock(this.clock, 10_000);
  private pending: ((t: number) => void) | null = null;
  private vsync = 10_000;
  /** Frame indices (since start) that are skipped to simulate jank. */
  stalls = new Map<number, number>();
  private frameIndex = 0;

  constructor(readonly hz = 60) {}

  get interval(): number {
    return 1000 / this.hz;
  }

  request(callback: (t: number) => void): void {
    this.pending = callback;
  }

  cancel(): void {
    this.pending = null;
  }

  get hasPending(): boolean {
    return this.pending !== null;
  }

  /** Advances to the next vsync and runs the pending frame callback. */
  step(): void {
    const extra = this.stalls.get(this.frameIndex) ?? 0;
    this.frameIndex++;
    this.vsync += this.interval * (1 + extra);
    this.clock.set(this.vsync);
    const cb = this.pending;
    this.pending = null;
    cb?.(this.vsync);
  }

  /** Advance the platform clock without a frame (e.g. to deliver input). */
  advanceTo(platformTime: number): void {
    this.clock.set(platformTime);
  }
}

export class ScriptedInput implements InputSource {
  private handler: ((input: RawInput) => void) | null = null;

  subscribe(handler: (input: RawInput) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  press(sourceTime: number, key = 'Space', repeat = false): void {
    this.handler?.({ input: 'keyboard', key, sourceTime, repeat });
  }
}

export class ScriptedEnvironment implements EnvironmentSource {
  private handler: ((s: EnvironmentSignal) => void) | null = null;

  subscribe(handler: (s: EnvironmentSignal) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  emit(signal: EnvironmentSignal): void {
    this.handler?.(signal);
  }
}

/** Lets pending promise continuations run. */
export const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));
