export interface Summary {
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Sample standard deviation (n − 1). Returns NaN for fewer than 2 values. */
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

/** Linear-interpolated quantile (type 7, the R/NumPy default). q in [0, 1]. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  if (q < 0 || q > 1) throw new RangeError('quantile must be within [0, 1]');
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const loVal = sorted[lo]!;
  return loVal + (sorted[hi]! - loVal) * (pos - lo);
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

/** Median absolute deviation — robust spread used for jitter estimates. */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

export function summarize(values: readonly number[]): Summary {
  return {
    n: values.length,
    mean: mean(values),
    sd: standardDeviation(values),
    min: values.length ? Math.min(...values) : Number.NaN,
    max: values.length ? Math.max(...values) : Number.NaN,
    median: median(values),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
  };
}

/** Successive differences of a timestamp series. */
export function intervals(timestamps: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < timestamps.length; i++) out.push(timestamps[i]! - timestamps[i - 1]!);
  return out;
}

/** Rounds to a fixed number of decimals without string round-tripping. */
export function round(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
