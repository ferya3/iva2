import { mean, median, round, standardDeviation } from '@cognitest/timing-core';
import type { Metric } from './types';
import type { ScoredTrial } from './trials';

/** Inverse standard normal CDF (Acklam's algorithm, |error| < 1.2e-9 after refinement). */
export function probit(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError('probit requires 0 < p < 1');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  return x;
}

/**
 * Signal-detection indices with the log-linear correction (Hautus, 1995),
 * which keeps d′ finite when hit or false-alarm rates are 0 or 1.
 */
export function signalDetection(hits: number, targets: number, falseAlarms: number, nonTargets: number) {
  if (targets === 0 || nonTargets === 0) return { dPrime: null, criterion: null };
  const h = (hits + 0.5) / (targets + 1);
  const f = (falseAlarms + 0.5) / (nonTargets + 1);
  const zh = probit(h);
  const zf = probit(f);
  return { dPrime: zh - zf, criterion: -(zh + zf) / 2 };
}

/** Ordinary least-squares slope of y on x. */
export function slope(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

const n = (v: number | null | undefined, d = 3): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v, d);

export function scopeMetrics(trials: readonly ScoredTrial[], scope: string): Metric[] {
  const t = trials.filter((x) => !x.excluded);
  const targets = t.filter((x) => x.stimulus.is_target);
  const nonTargets = t.filter((x) => !x.stimulus.is_target);
  const hits = targets.filter((x) => x.outcome === 'hit');
  const commissions = nonTargets.filter((x) => x.outcome === 'commission');
  const rts = hits.map((x) => x.rt!).filter((v) => Number.isFinite(v));
  const rtMean = rts.length ? mean(rts) : null;
  const rtSd = rts.length > 1 ? standardDeviation(rts) : null;
  const sdt = signalDetection(hits.length, targets.length, commissions.length, nonTargets.length);
  const rate = (a: number, b: number) => (b ? a / b : null);

  const m = (key: string, value: number | null, unit: string | null = null): Metric => ({ key, value, unit, scope });
  return [
    m('trials', t.length, 'count'),
    m('excluded_trials', trials.length - t.length, 'count'),
    m('targets', targets.length, 'count'),
    m('non_targets', nonTargets.length, 'count'),
    m('hits', hits.length, 'count'),
    m('omissions', targets.length - hits.length, 'count'),
    m('commissions', commissions.length, 'count'),
    m('correct_rejections', nonTargets.length - commissions.length, 'count'),
    m('hit_rate', n(rate(hits.length, targets.length), 4), 'ratio'),
    m('omission_rate', n(rate(targets.length - hits.length, targets.length), 4), 'ratio'),
    m('commission_rate', n(rate(commissions.length, nonTargets.length), 4), 'ratio'),
    m('anticipatory_responses', t.filter((x) => x.anticipatory).length, 'count'),
    m('repeated_responses', t.reduce((acc, x) => acc + x.repeats, 0), 'count'),
    m('rt_mean', n(rtMean), 'ms'),
    m('rt_median', n(rts.length ? median(rts) : null), 'ms'),
    m('rt_sd', n(rtSd), 'ms'),
    m('rt_cv', n(rtMean && rtSd !== null ? rtSd / rtMean : null, 4), 'ratio'),
    m('d_prime', n(sdt.dPrime, 4), null),
    m('criterion_c', n(sdt.criterion, 4), null),
  ];
}

/** Change of performance over the scored blocks (vigilance decrement). */
export function trendMetrics(trials: readonly ScoredTrial[]): Metric[] {
  const blocks = [...new Set(trials.map((t) => t.blockKey))];
  const xs: number[] = [];
  const rtMeans: number[] = [];
  const hitRates: number[] = [];
  blocks.forEach((key, i) => {
    const bt = trials.filter((t) => t.blockKey === key && !t.excluded);
    const targets = bt.filter((t) => t.stimulus.is_target);
    const rts = bt.filter((t) => t.outcome === 'hit').map((t) => t.rt!);
    if (!rts.length || !targets.length) return;
    xs.push(i);
    rtMeans.push(mean(rts));
    hitRates.push(rts.length / targets.length);
  });
  return [
    { key: 'rt_mean_slope_per_block', value: n(slope(xs, rtMeans)), unit: 'ms/block', scope: 'overall' },
    { key: 'hit_rate_slope_per_block', value: n(slope(xs, hitRates), 5), unit: 'ratio/block', scope: 'overall' },
  ];
}
