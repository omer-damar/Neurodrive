import { test } from 'node:test';
import assert from 'node:assert/strict';

import { permutationTest, pairedPermutationTest, cliffsDelta, deltaSize, holm, compareGroups } from '../scripts/lib/stats.mjs';

test('the exact permutation test matches a hand count', () => {
  // a = {3, 4}, b = {1, 2}: of the 6 ways to pick two values, only {3, 4} and {1, 2} reach |diff| = 2.
  const r = permutationTest([3, 4], [1, 2]);
  assert.equal(r.exact, true);
  assert.equal(r.diff, 2);
  assert.ok(Math.abs(r.p - 2 / 6) < 1e-12);
});

test('identical groups give p = 1; clearly separated groups of ten give a tiny p', () => {
  assert.equal(permutationTest([1, 2, 3], [1, 2, 3]).p, 1);
  const low = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  const high = [3, 3, 3, 3, 3, 3, 3, 3, 3, 2];
  const r = permutationTest(high, low);
  assert.equal(r.exact, true); // C(20, 10) = 184,756 relabellings, counted exactly
  assert.ok(r.p < 0.0001);
});

test('large groups fall back to a seeded Monte Carlo test that is reproducible', () => {
  const a = Array.from({ length: 30 }, (_, i) => i % 4);
  const b = Array.from({ length: 30 }, (_, i) => (i % 4) + 0.5);
  const r1 = permutationTest(a, b);
  const r2 = permutationTest(a, b);
  assert.equal(r1.exact, false);
  assert.equal(r1.p, r2.p);
  assert.ok(r1.p > 0 && r1.p < 0.2);
});

test("Cliff's delta and its size labels", () => {
  assert.equal(cliffsDelta([3, 3], [0, 0]), 1);
  assert.equal(cliffsDelta([0, 0], [3, 3]), -1);
  assert.equal(cliffsDelta([1, 2], [1, 2]), 0);
  assert.equal(cliffsDelta([2, 1], [1, 0]), 0.75);
  assert.deepEqual([0.1, 0.2, 0.4, 0.9].map(deltaSize), ['negligible', 'small', 'medium', 'large']);
});

test('Holm adjustment is monotone and capped at 1', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.deepEqual(holm([0.5, 0.6]), [1, 1]);
});

test('compareGroups makes every pair once, with Holm-adjusted p values', () => {
  const pairs = compareGroups([
    { label: 'a', values: [0, 0, 1] },
    { label: 'b', values: [2, 3, 3] },
    { label: 'c', values: [0, 1, 0] },
  ]);
  assert.deepEqual(pairs.map((x) => `${x.a}-${x.b}`), ['a-b', 'a-c', 'b-c']);
  for (const x of pairs) assert.ok(x.pHolm >= x.p);
});

test('the paired sign-flip test counts every sign pattern', () => {
  // differences 1, 1, 1: of the 8 sign patterns only +++ and --- reach |sum| = 3.
  const r = pairedPermutationTest([3, 3, 3], [2, 2, 2]);
  assert.equal(r.exact, true);
  assert.equal(r.diff, 1);
  assert.ok(Math.abs(r.p - 2 / 8) < 1e-12);
  assert.equal(pairedPermutationTest([1, 2], [1, 2]).p, 1);
  const before = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
  const after = [2, 1, 2, 2, 1, 2, 3, 2, 2, 1];
  assert.ok(pairedPermutationTest(before, after).p < 0.01);
});
