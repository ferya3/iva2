import type { PresentationStatus } from '@cognitest/shared-types';
import type { AudioPort, VisualPort } from '../ports';
import type { ProtocolDefinition, Trial } from '../protocols/types';
import type { FrameTick } from '../visual/frame-monitor';

export interface TrialRuntime {
  trial: Trial;
  plannedAt: number;
  sequence: number | null;
  actualAt: number | null;
  status: PresentationStatus | null;
  cleared: boolean;
  responded: boolean;
}

export interface SchedulerEffects {
  presented(rt: TrialRuntime, frameNumber: number | null): number;
  cleared(rt: TrialRuntime): void;
}

/** Tolerance (ms) added to the half-frame window when classifying onsets. */
const ONSET_EPSILON_MS = 0.5;

/**
 * Frame-driven scheduler for one block. Visual stimuli are committed in the
 * frame whose projected vsync is closest to the planned onset; audio is
 * handed to the audio clock ahead of time (lookahead) for sample-accurate
 * onset. All decisions are made from the frame timestamp, never from timers.
 */
export class BlockScheduler {
  readonly runtimes: TrialRuntime[];
  private next = 0;
  private origin: number | null = null;
  private visualActive: TrialRuntime | null = null;

  constructor(
    private readonly protocol: ProtocolDefinition,
    trials: readonly Trial[],
    private readonly visual: VisualPort,
    private readonly audio: AudioPort | null,
    private readonly effects: SchedulerEffects,
  ) {
    this.runtimes = trials.map((trial) => ({
      trial,
      plannedAt: Number.NaN,
      sequence: null,
      actualAt: null,
      status: null,
      cleared: false,
      responded: false,
    }));
  }

  get started(): boolean {
    return this.origin !== null;
  }

  get done(): boolean {
    const last = this.runtimes.at(-1);
    return (
      this.next >= this.runtimes.length &&
      this.runtimes.every((r) => r.cleared) &&
      (!last || this.lastFrameTime >= (last.actualAt ?? last.plannedAt) + this.protocol.timing.responseWindowMs)
    );
  }

  private lastFrameTime = Number.NEGATIVE_INFINITY;

  onFrame(tick: FrameTick, frameInterval: number): void {
    const t = tick.time;
    this.lastFrameTime = t;
    if (this.origin === null) {
      this.origin = t + this.protocol.timing.leadInMs;
      for (const rt of this.runtimes) rt.plannedAt = this.origin + rt.trial.onsetMs;
    }
    const projected = t + this.protocol.timing.presentationLatencyFrames * frameInterval;

    this.handleOffsets(t, projected, frameInterval);

    while (this.next < this.runtimes.length) {
      const rt = this.runtimes[this.next]!;
      const handled =
        rt.trial.modality === 'visual'
          ? this.tryPresentVisual(rt, tick, projected, frameInterval)
          : this.trySchedule(rt, t);
      if (!handled) break;
      this.next++;
    }
  }

  private tryPresentVisual(rt: TrialRuntime, tick: FrameTick, projected: number, interval: number): boolean {
    if (projected < rt.plannedAt - interval / 2) return false;
    if (this.visualActive) {
      // Previous stimulus overran (stall): clear it first, then present.
      this.clearVisual(this.visualActive);
    }
    if (projected > rt.plannedAt + rt.trial.durationMs) {
      // The whole presentation window was missed (window hidden / stall).
      rt.status = 'dropped';
      rt.actualAt = projected;
      rt.sequence = this.effects.presented(rt, tick.frameNumber);
      rt.cleared = true;
      return true;
    }
    this.visual.show(rt.trial.stimulusId);
    rt.actualAt = projected;
    rt.status =
      Math.abs(projected - rt.plannedAt) <= interval / 2 + ONSET_EPSILON_MS ? 'on_time' : 'late';
    rt.sequence = this.effects.presented(rt, tick.frameNumber);
    this.visualActive = rt;
    return true;
  }

  private trySchedule(rt: TrialRuntime, now: number): boolean {
    if (rt.plannedAt - now > this.protocol.timing.audioLookaheadMs) return false;
    if (!this.audio) throw new Error('protocol requires audio but no audio port is available');
    if (now > rt.plannedAt + rt.trial.durationMs) {
      rt.status = 'dropped';
      rt.actualAt = rt.plannedAt;
      rt.sequence = this.effects.presented(rt, null);
      rt.cleared = true;
      return true;
    }
    const actual = this.audio.schedule(rt.trial.stimulusId, rt.plannedAt);
    rt.actualAt = actual;
    rt.status = Math.abs(actual - rt.plannedAt) <= 1 ? 'on_time' : 'late';
    rt.sequence = this.effects.presented(rt, null);
    return true;
  }

  private handleOffsets(now: number, projected: number, interval: number): void {
    const v = this.visualActive;
    if (v && projected >= v.actualAt! + v.trial.durationMs - interval / 2) this.clearVisual(v);
    for (const rt of this.runtimes) {
      if (rt.trial.modality === 'auditory' && rt.actualAt !== null && !rt.cleared) {
        if (now >= rt.actualAt + rt.trial.durationMs) {
          rt.cleared = true;
          this.effects.cleared(rt);
        }
      }
    }
  }

  private clearVisual(rt: TrialRuntime): void {
    this.visual.clear();
    rt.cleared = true;
    this.visualActive = null;
    this.effects.cleared(rt);
  }

  /** Most recent presented (non-dropped) trial with onset ≤ time. */
  latestPresentedBefore(time: number): TrialRuntime | null {
    for (let i = this.next - 1; i >= 0; i--) {
      const rt = this.runtimes[i]!;
      if (rt.status !== null && rt.status !== 'dropped' && rt.actualAt! <= time) return rt;
    }
    return null;
  }

  /** Stops everything immediately (abort). */
  halt(): void {
    if (this.visualActive) this.visual.clear();
    this.visualActive = null;
    this.audio?.stopAll();
  }
}
