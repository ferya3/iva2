import { OffsetClock, PerformanceClock, type Clock } from '@cognitest/timing-core';
import type { SessionClock } from '../ports';

/** Session clock anchored at "now" on the platform performance timeline. */
export function createSessionClock(source: Clock = new PerformanceClock()): SessionClock & { origin: number } {
  return new OffsetClock(source);
}
