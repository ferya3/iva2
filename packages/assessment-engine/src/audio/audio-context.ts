/**
 * Mapping between the AudioContext clock (seconds) and the performance
 * timeline (ms). getOutputTimestamp() returns a simultaneous pair of both,
 * which lets us place sounds on the same timebase as visual frames.
 */
export interface ClockPair {
  contextTime: number;
  performanceTime: number;
}

export function contextTimeFor(performanceTimeMs: number, pair: ClockPair): number {
  return pair.contextTime + (performanceTimeMs - pair.performanceTime) / 1000;
}

export function performanceTimeFor(contextTimeS: number, pair: ClockPair): number {
  return pair.performanceTime + (contextTimeS - pair.contextTime) * 1000;
}
