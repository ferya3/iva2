import { describe, expect, it } from 'vitest';
import { DEMO_CPT_PROTOCOL, ProtocolError, assertValidProtocol, buildTimeline } from '../src';
import { SMALL_PROTOCOL, withModalities } from './helpers';

describe('timeline', () => {
  it('is fully determined by the seed', () => {
    expect(buildTimeline(DEMO_CPT_PROTOCOL, 99)).toEqual(buildTimeline(DEMO_CPT_PROTOCOL, 99));
    expect(buildTimeline(DEMO_CPT_PROTOCOL, 99)).not.toEqual(buildTimeline(DEMO_CPT_PROTOCOL, 100));
  });

  it('honours target ratio, SOA range and run-length limits', () => {
    for (let seed = 0; seed < 50; seed++) {
      const blocks = buildTimeline(DEMO_CPT_PROTOCOL, seed);
      blocks.forEach((trials, b) => {
        const def = DEMO_CPT_PROTOCOL.blocks[b]!;
        expect(trials.filter((t) => t.isTarget)).toHaveLength(Math.round(def.trials * def.targetRatio));
        for (let i = 1; i < trials.length; i++) {
          const soa = trials[i]!.onsetMs - trials[i - 1]!.onsetMs;
          expect(soa).toBeGreaterThanOrEqual(1400);
          expect(soa).toBeLessThanOrEqual(1800);
        }
        if (def.maxConsecutiveTargets) {
          let run = 0;
          for (const t of trials) {
            run = t.isTarget ? run + 1 : 0;
            expect(run).toBeLessThanOrEqual(def.maxConsecutiveTargets);
          }
        }
      });
    }
  });

  it('only uses stimuli of the trial modality and target class', () => {
    const [trials] = buildTimeline(withModalities(['visual', 'auditory'], 200), 3);
    for (const t of trials!) {
      expect(t.stimulusId).toBe(t.modality === 'visual' ? (t.isTarget ? 'go' : 'nogo') : t.isTarget ? 'hi' : 'lo');
    }
    expect(new Set(trials!.map((t) => t.modality)).size).toBe(2);
  });
});

describe('protocol validation', () => {
  it('accepts the demo protocol', () => {
    expect(() => assertValidProtocol(DEMO_CPT_PROTOCOL)).not.toThrow();
  });

  it('rejects a response window longer than the SOA', () => {
    const bad = { ...SMALL_PROTOCOL, timing: { ...SMALL_PROTOCOL.timing, responseWindowMs: 5000 } };
    expect(() => assertValidProtocol(bad)).toThrow(ProtocolError);
  });

  it('rejects stimuli of the wrong modality', () => {
    const bad = {
      ...SMALL_PROTOCOL,
      blocks: [{ ...SMALL_PROTOCOL.blocks[0]!, targets: { visual: ['hi'] } }],
    };
    expect(() => assertValidProtocol(bad)).toThrow(/not visual/);
  });
});
