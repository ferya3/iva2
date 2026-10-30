import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@cognitest/shared-types';
import { DEMO_CPT_PROTOCOL } from '@cognitest/assessment-engine';
import { ALGORITHM_VERSION, scoreSession } from '../src';
import { createHarness, runToEnd } from '../../assessment-engine/tests/helpers';

const metric = (r: ReturnType<typeof scoreSession>, key: string, scope = 'overall') =>
  r.metrics.find((m) => m.key === key && m.scope === scope)?.value;

/** Simulated participant: responds to targets at a fixed RT, misses every 5th target, commits on every 4th non-target. */
async function simulate() {
  const h = createHarness(DEMO_CPT_PROTOCOL, { seed: 2026 });
  let targets = 0;
  let nonTargets = 0;
  await runToEnd(h, (s) => {
    if (s.is_target) return ++targets % 5 === 0 ? null : 400;
    return ++nonTargets % 4 === 0 ? 300 : null;
  });
  return h.sink.events;
}

describe('scoreSession (engine → scoring integration)', () => {
  it('recovers the simulated behaviour exactly', async () => {
    const events = await simulate();
    const r = scoreSession(events);
    expect(r.algorithm_version).toBe(ALGORITHM_VERSION);
    expect(r.validity_status).toBe('valid');
    expect(r.trial_count).toBe(200);
    expect(metric(r, 'rt_mean')).toBeCloseTo(400, 3);
    expect(metric(r, 'rt_sd')).toBeCloseTo(0, 3);
    expect(metric(r, 'targets')).toBe(100);
    // practice has 8 targets/8 non-targets consumed by the counters first
    const hits = metric(r, 'hits')!;
    const omissions = metric(r, 'omissions')!;
    expect(hits + omissions).toBe(100);
    expect(omissions).toBeGreaterThanOrEqual(19);
    expect(omissions).toBeLessThanOrEqual(21);
    expect(metric(r, 'commissions')).toBeGreaterThanOrEqual(24);
    expect(metric(r, 'commissions')).toBeLessThanOrEqual(26);
    expect(metric(r, 'd_prime')).toBeGreaterThan(0);
  });

  it('excludes practice and reports per modality and per block', async () => {
    const r = scoreSession(await simulate());
    expect(r.metrics.some((m) => m.scope === 'block:practice')).toBe(false);
    expect(['main-1', 'main-2', 'main-3', 'main-4'].every((b) => metric(r, 'trials', `block:${b}`) === 50)).toBe(true);
    expect(metric(r, 'trials', 'visual')! + metric(r, 'trials', 'auditory')!).toBe(200);
  });

  it('is deterministic', async () => {
    const events = await simulate();
    expect(scoreSession(events)).toEqual(scoreSession([...events].reverse()));
  });
});

describe('quality control', () => {
  const base = async () => simulate();

  it('invalidates a stream with a sequence gap', async () => {
    const events = (await base()).filter((e) => e.sequence !== 50);
    const r = scoreSession(events);
    expect(r.validity_status).toBe('invalid');
    expect(r.quality_flags.map((f) => f.code)).toContain('integrity.sequence_gap');
  });

  it('invalidates an aborted session', async () => {
    const events = await base();
    const last = events.at(-1)! as Extract<SessionEvent, { type: 'session_ended' }>;
    const r = scoreSession([...events.slice(0, -1), { ...last, reason: 'aborted' }]);
    expect(r.quality_flags).toContainEqual(expect.objectContaining({ code: 'run.aborted', severity: 'critical' }));
  });

  it('flags but does not invalidate a single short interruption', async () => {
    const events = await base();
    const end = events.at(-1)!;
    const mid = events[500]!;
    const patched: SessionEvent[] = [
      ...events.slice(0, 501),
      { sequence: 502, type: 'focus_lost', timestamp_ms: mid.timestamp_ms },
      { sequence: 503, type: 'focus_gained', timestamp_ms: mid.timestamp_ms },
      ...events.slice(501).map((e) => ({ ...e, sequence: e.sequence + 2 })),
    ];
    const r = scoreSession(patched);
    expect(r.validity_status).toBe('questionable');
    expect(r.quality_flags.map((f) => f.code)).toEqual(['environment.focus_lost']);
    expect(end.type).toBe('session_ended');
  });

  it('accepts custom thresholds from the protocol validation rules', async () => {
    const r = scoreSession(await base(), { quality: { omissionRate: { warn: 0.1, critical: 0.15 } } as never });
    expect(r.quality_flags.find((f) => f.code === 'engagement.omissions')?.severity).toBe('critical');
  });
});
