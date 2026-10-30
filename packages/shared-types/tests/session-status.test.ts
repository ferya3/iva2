import { describe, expect, it } from 'vitest';
import { SESSION_TRANSITIONS, SessionStatus, canTransition, isTerminal } from '../src';

describe('session status machine', () => {
  it('follows the happy path from CREATED to REPORTED', () => {
    const path: SessionStatus[] = [
      'CREATED',
      'INVITED',
      'DEVICE_CHECK',
      'CALIBRATION',
      'READY',
      'RUNNING',
      'UPLOADING',
      'COMPLETED',
      'VALIDATED',
      'REPORTED',
    ];
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(path[i - 1]!, path[i]!)).toBe(true);
    }
  });

  it('never leaves a terminal state', () => {
    for (const status of ['REPORTED', 'INVALID', 'CANCELLED', 'EXPIRED'] as const) {
      expect(isTerminal(status)).toBe(true);
    }
  });

  it('cannot invalidate a session that never ran', () => {
    expect(canTransition('READY', 'INVALID')).toBe(false);
    expect(canTransition('CREATED', 'RUNNING')).toBe(false);
  });

  it('declares a transition list for every status', () => {
    expect(Object.keys(SESSION_TRANSITIONS).sort()).toEqual(Object.values(SessionStatus).sort());
  });
});
