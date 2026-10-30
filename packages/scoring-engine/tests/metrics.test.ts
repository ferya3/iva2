import { describe, expect, it } from 'vitest';
import { probit, signalDetection, slope } from '../src';

describe('probit', () => {
  it('matches reference quantiles of the standard normal', () => {
    expect(probit(0.5)).toBeCloseTo(0, 9);
    expect(probit(0.975)).toBeCloseTo(1.959964, 5);
    expect(probit(0.01)).toBeCloseTo(-2.326348, 5);
    expect(probit(0.999)).toBeCloseTo(3.090232, 5);
  });

  it('rejects 0 and 1', () => {
    expect(() => probit(0)).toThrow();
    expect(() => probit(1)).toThrow();
  });
});

describe('signal detection', () => {
  it('applies the log-linear correction', () => {
    const { dPrime, criterion } = signalDetection(20, 25, 5, 25);
    const zh = probit(20.5 / 26);
    const zf = probit(5.5 / 26);
    expect(dPrime).toBeCloseTo(zh - zf, 12);
    expect(criterion).toBeCloseTo(0, 12); // symmetric case
  });

  it('stays finite for perfect performance', () => {
    expect(Number.isFinite(signalDetection(40, 40, 0, 10).dPrime!)).toBe(true);
  });

  it('is undefined without both stimulus classes', () => {
    expect(signalDetection(5, 5, 0, 0).dPrime).toBeNull();
  });
});

describe('slope', () => {
  it('computes OLS slope', () => {
    expect(slope([0, 1, 2, 3], [400, 410, 420, 430])).toBeCloseTo(10, 9);
    expect(slope([0], [1])).toBeNull();
  });
});
