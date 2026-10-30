import { IntervalTracker } from '@cognitest/timing-core';

export interface FrameTick {
  frameNumber: number;
  time: number;
  droppedFrames: number;
  interval: number | null;
}

/** Counts frames and flags missed vsyncs on the session timebase. */
export class FrameMonitor {
  private readonly tracker: IntervalTracker;
  private frame = 0;

  constructor(nominalIntervalMs: number) {
    this.tracker = new IntervalTracker(nominalIntervalMs);
  }

  tick(time: number): FrameTick {
    const sample = this.tracker.push(time);
    this.frame++;
    return {
      frameNumber: this.frame,
      time,
      droppedFrames: sample?.droppedFrames ?? 0,
      interval: sample?.interval ?? null,
    };
  }

  /** Call when the loop resumes after an intentional pause. */
  resume(): void {
    this.tracker.breakSeries();
  }

  get expectedInterval(): number {
    return this.tracker.expectedInterval;
  }

  get droppedFrames(): number {
    return this.tracker.droppedFrames;
  }

  get droppedRatio(): number {
    return this.tracker.droppedRatio;
  }
}
