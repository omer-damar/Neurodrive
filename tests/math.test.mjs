import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32, gaussian, clamp, segmentIntersectT, wrapDelta } from '../src/core/math.js';

test('mulberry32 is deterministic and stays in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('gaussian has roughly zero mean and unit variance', () => {
  const rng = mulberry32(7);
  const count = 20000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < count; i++) {
    const g = gaussian(rng);
    sum += g;
    sumSq += g * g;
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean}`);
  assert.ok(Math.abs(variance - 1) < 0.05, `variance ${variance}`);
});

test('segmentIntersectT returns t along AB for crossing segments', () => {
  assert.equal(segmentIntersectT(0, 0, 10, 0, 5, -5, 5, 5), 0.5);
  assert.equal(segmentIntersectT(0, 0, 10, 0, 2, -1, 2, 1), 0.2);
});

test('segmentIntersectT includes touching endpoints', () => {
  assert.equal(segmentIntersectT(0, 0, 10, 0, 10, -5, 10, 5), 1);
});

test('segmentIntersectT returns -1 for parallel or separate segments', () => {
  assert.equal(segmentIntersectT(0, 0, 10, 0, 0, 1, 10, 1), -1); // parallel
  assert.equal(segmentIntersectT(0, 0, 10, 0, 0, 0, 10, 0), -1); // collinear
  assert.equal(segmentIntersectT(0, 0, 10, 0, 11, -5, 11, 5), -1); // beyond B
  assert.equal(segmentIntersectT(0, 0, 10, 0, 5, 1, 5, 5), -1); // stops short of AB
});

test('clamp and wrapDelta', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
  assert.equal(wrapDelta(99, 100), -1);
  assert.equal(wrapDelta(-99, 100), 1);
  assert.equal(wrapDelta(3, 100), 3);
});
