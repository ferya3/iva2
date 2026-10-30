/**
 * Online tracker of inter-frame intervals. Detects frames that took longer
 * than `dropThreshold` × the nominal interval and estimates how many vsyncs
 * were missed. O(1) per sample; keeps a bounded window for statistics.
 */
export interface IntervalSample {
  interval: number;
  droppedFrames: number;
}

export class IntervalTracker {
  private last: number | null = null;
  private readonly window: number[] = [];
  private totalDropped = 0;
  private count = 0;

  constructor(
    private nominalInterval: number,
    private readonly dropThreshold = 1.5,
    private readonly windowSize = 600,
  ) {
    if (nominalInterval <= 0) throw new RangeError('nominal interval must be positive');
  }

  get expectedInterval(): number {
    return this.nominalInterval;
  }

  /** Update the nominal interval once calibration has measured the display. */
  setNominalInterval(interval: number): void {
    if (interval <= 0) throw new RangeError('nominal interval must be positive');
    this.nominalInterval = interval;
  }

  push(timestamp: number): IntervalSample | null {
    const previous = this.last;
    this.last = timestamp;
    if (previous === null) return null;
    const interval = timestamp - previous;
    this.count++;
    this.window.push(interval);
    if (this.window.length > this.windowSize) this.window.shift();
    const droppedFrames =
      interval > this.nominalInterval * this.dropThreshold
        ? Math.max(1, Math.round(interval / this.nominalInterval) - 1)
        : 0;
    this.totalDropped += droppedFrames;
    return { interval, droppedFrames };
  }

  /**
   * Starts a new series without losing statistics, e.g. after the frame
   * loop was intentionally paused between blocks (not a dropped frame).
   */
  breakSeries(): void {
    this.last = null;
  }

  reset(): void {
    this.last = null;
    this.window.length = 0;
    this.totalDropped = 0;
    this.count = 0;
  }

  get samples(): readonly number[] {
    return this.window;
  }

  get frames(): number {
    return this.count;
  }

  get droppedFrames(): number {
    return this.totalDropped;
  }

  /** Dropped vsyncs relative to all vsyncs that should have been presented. */
  get droppedRatio(): number {
    const expected = this.count + this.totalDropped;
    return expected === 0 ? 0 : this.totalDropped / expected;
  }
}
