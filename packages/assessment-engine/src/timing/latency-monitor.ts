import { summarize, type Summary } from '@cognitest/timing-core';

/**
 * Tracks input dispatch latency (handler time − event timestamp) during the
 * run. A sustained rise indicates main-thread contention that may distort
 * reaction times and is reported to the quality-control layer.
 */
export class LatencyMonitor {
  private readonly samples: number[] = [];

  record(eventTime: number, handlerTime: number): number {
    const latency = Math.max(0, handlerTime - eventTime);
    this.samples.push(latency);
    return latency;
  }

  summary(): Summary {
    return summarize(this.samples);
  }
}
