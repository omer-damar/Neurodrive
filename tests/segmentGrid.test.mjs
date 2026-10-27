import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SegmentGrid } from '../src/core/segmentGrid.js';
import { mulberry32 } from '../src/core/math.js';

function results(grid, count) {
  return Array.from(grid.result.subarray(0, count)).sort((a, b) => a - b);
}

test('queryBox finds nearby segments and skips far ones', () => {
  const segments = new Float64Array([
    0, 0, 40, 0, // 0: near origin
    500, 500, 540, 500, // 1: far away
    10, 10, 10, 30, // 2: near origin
  ]);
  const grid = new SegmentGrid(segments, 50);
  assert.deepEqual(results(grid, grid.queryBox(0, 0, 20, 20)), [0, 2]);
  assert.deepEqual(results(grid, grid.queryBox(490, 490, 510, 510)), [1]);
});

test('a segment spanning many cells is reported once', () => {
  const grid = new SegmentGrid(new Float64Array([0, 0, 1000, 0, 0, 100, 0, 101]), 50);
  assert.deepEqual(results(grid, grid.queryBox(-10, -10, 1010, 10)), [0]);
});

test('queryBox returns a superset of segments whose bounds overlap the box', () => {
  const rng = mulberry32(3);
  const count = 300;
  const segments = new Float64Array(count * 4);
  for (let i = 0; i < count; i++) {
    const x = rng() * 1000;
    const y = rng() * 800;
    segments.set([x, y, x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 60], i * 4);
  }
  const grid = new SegmentGrid(segments, 50);

  for (let q = 0; q < 50; q++) {
    const x0 = rng() * 1000;
    const y0 = rng() * 800;
    const x1 = x0 + rng() * 120;
    const y1 = y0 + rng() * 120;
    const found = new Set(results(grid, grid.queryBox(x0, y0, x1, y1)));
    assert.equal(found.size, grid.queryBox(x0, y0, x1, y1), 'no duplicates');
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      const overlaps =
        Math.max(segments[o], segments[o + 2]) >= x0 &&
        Math.min(segments[o], segments[o + 2]) <= x1 &&
        Math.max(segments[o + 1], segments[o + 3]) >= y0 &&
        Math.min(segments[o + 1], segments[o + 3]) <= y1;
      if (overlaps) assert.ok(found.has(i), `segment ${i} missing from query ${q}`);
    }
  }
});
