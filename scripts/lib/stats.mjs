// Significance tests for the experiment reports, dependency-free and deterministic.
// - Two-sided permutation test on the difference of means: exact (every relabelling counted) when
//   that is affordable, otherwise a seeded Monte Carlo estimate, so a report never changes between runs.
// - Holm–Bonferroni adjustment when one report makes several comparisons.
// - Cliff's delta as effect size: P(a > b) − P(a < b), from −1 to 1; suits small samples and
//   bounded, tied data such as laps (0–3).
import { mulberry32 } from '../../src/core/math.js';

const EXACT_LIMIT = 200_000; // relabellings counted exactly up to this many
const MONTE_CARLO_ROUNDS = 20_000;
const MONTE_CARLO_SEED = 12345;
const EPSILON = 1e-9; // ties in the statistic count as "at least as extreme"

/**
 * Two-sided permutation test for a difference in means.
 * @returns {{ p: number, exact: boolean, diff: number }} diff = mean(a) − mean(b)
 */
export function permutationTest(a, b) {
  const all = [...a, ...b];
  const n = all.length;
  const k = a.length;
  const total = all.reduce((s, v) => s + v, 0);
  const observed = Math.abs(meanDiff(sum(a), k, total, n));
  if (k === 0 || k === n) return { p: 1, exact: true, diff: 0 };
  const diff = sum(a) / k - sum(b) / b.length;
  if (binomial(n, k) <= EXACT_LIMIT) {
    let extreme = 0;
    let count = 0;
    forEachSubsetSum(all, k, (subsetSum) => {
      count++;
      if (Math.abs(meanDiff(subsetSum, k, total, n)) >= observed - EPSILON) extreme++;
    });
    return { p: extreme / count, exact: true, diff };
  }
  const rng = mulberry32(MONTE_CARLO_SEED);
  const pool = all.slice();
  let extreme = 0;
  for (let round = 0; round < MONTE_CARLO_ROUNDS; round++) {
    // Partial Fisher–Yates: the first k items are a random group.
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (n - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let s = 0;
    for (let i = 0; i < k; i++) s += pool[i];
    if (Math.abs(meanDiff(s, k, total, n)) >= observed - EPSILON) extreme++;
  }
  return { p: (extreme + 1) / (MONTE_CARLO_ROUNDS + 1), exact: false, diff };
}

/**
 * Two-sided paired permutation (sign-flip) test: the same runs measured twice (e.g. one brain at two
 * noise levels). Under "no effect" each run's difference is as likely positive as negative, so every
 * sign pattern is counted (exact up to 2^17 patterns, seeded Monte Carlo beyond).
 * @returns {{ p: number, exact: boolean, diff: number }} diff = mean(a − b)
 */
export function pairedPermutationTest(a, b) {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length;
  const diff = sum(d) / n;
  const observed = Math.abs(sum(d));
  if (observed < EPSILON) return { p: 1, exact: true, diff };
  const exact = n <= 17;
  const rng = exact ? null : mulberry32(MONTE_CARLO_SEED);
  const rounds = exact ? 2 ** n : MONTE_CARLO_ROUNDS;
  let extreme = 0;
  for (let mask = 0; mask < rounds; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (exact ? (mask >> i) & 1 : rng() < 0.5) ? -d[i] : d[i];
    if (Math.abs(s) >= observed - EPSILON) extreme++;
  }
  return exact ? { p: extreme / rounds, exact, diff } : { p: (extreme + 1) / (rounds + 1), exact, diff };
}

/** Cliff's delta: P(a > b) − P(a < b) over all pairs. */
export function cliffsDelta(a, b) {
  let more = 0;
  let less = 0;
  for (const x of a) {
    for (const y of b) {
      if (x > y) more++;
      else if (x < y) less++;
    }
  }
  return (more - less) / (a.length * b.length);
}

/** Conventional size label for |delta| (Romano et al. 2006 thresholds). */
export function deltaSize(delta) {
  const d = Math.abs(delta);
  return d < 0.147 ? 'negligible' : d < 0.33 ? 'small' : d < 0.474 ? 'medium' : 'large';
}

/** Holm–Bonferroni adjusted p-values, in the input order. */
export function holm(pValues) {
  const order = pValues.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const adjusted = new Array(pValues.length);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (pValues.length - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}

/**
 * Every pair of groups compared: permutation p, Holm-adjusted p and Cliff's delta.
 * @param {{ label: string, values: number[] }[]} groups
 */
export function compareGroups(groups) {
  const pairs = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      const test = permutationTest(a.values, b.values);
      const delta = cliffsDelta(a.values, b.values);
      pairs.push({ a: a.label, b: b.label, ...test, delta, size: deltaSize(delta) });
    }
  }
  holm(pairs.map((x) => x.p)).forEach((p, k) => {
    pairs[k].pHolm = p;
  });
  return pairs;
}

function sum(values) {
  return values.reduce((s, v) => s + v, 0);
}

// mean of the group minus mean of the rest, from the group's sum alone
function meanDiff(groupSum, k, total, n) {
  return groupSum / k - (total - groupSum) / (n - k);
}

function binomial(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

// Calls fn with the sum of every k-element subset of values (iterative, no arrays per subset).
function forEachSubsetSum(values, k, fn) {
  const n = values.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    let s = 0;
    for (let i = 0; i < k; i++) s += values[idx[i]];
    fn(s);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}
