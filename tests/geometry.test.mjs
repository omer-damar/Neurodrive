import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toWorld3,
  toRotationY,
  buildRoadStrip,
  buildBarrier,
  buildStartLine,
  trackBounds3,
  zoomTopCamera,
  barrierColor,
  BARRIER_COLORS,
} from '../src/ui/three/geometry.js';
import { Track, PRESETS } from '../src/core/track.js';
import { SCALE, BARRIER_HEIGHT } from '../src/core/config.js';

// y component of the triangle normal (b - a) × (c - a) in three.js space.
function normalY(positions, a, b, c) {
  const ax = positions[a * 3];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vz = positions[c * 3 + 2] - az;
  return uz * vx - ux * vz;
}

test('toWorld3 scales x and y onto the ground plane (x -> X, y -> Z)', () => {
  assert.deepEqual(toWorld3(100, 200), [100 * SCALE, 0, 200 * SCALE]);
  assert.deepEqual(toWorld3(0, 0, 0.5), [0, 0.5, 0]);
  assert.equal(SCALE, 0.05);
});

test('toRotationY maps a 2D heading so a +X model faces the same way as the 2D car', () => {
  for (const angle of [0, 0.3, Math.PI / 2, -2]) {
    const ry = toRotationY(angle);
    // Rotating (1, 0, 0) by ry around Y gives (cos ry, 0, -sin ry).
    const dir = [Math.cos(ry), -Math.sin(ry)];
    assert.ok(Math.abs(dir[0] - Math.cos(angle)) < 1e-12);
    assert.ok(Math.abs(dir[1] - Math.sin(angle)) < 1e-12);
  }
});

for (const name of Object.keys(PRESETS)) {
  test(`road strip for "${name}": 2(n+1) vertices, 6n in-range indices, all facing up`, () => {
    const track = Track.preset(name);
    const { positions, uvs, indices } = buildRoadStrip(track);
    const vertices = positions.length / 3;
    assert.equal(vertices, 2 * (track.n + 1));
    assert.equal(uvs.length, vertices * 2);
    assert.equal(indices.length, 6 * track.n);
    for (const i of indices) assert.ok(i < vertices);
    for (let t = 0; t < indices.length; t += 3) {
      assert.ok(normalY(positions, indices[t], indices[t + 1], indices[t + 2]) > 0, `triangle ${t / 3} faces down`);
    }
  });
}

test('road v coordinate runs from 0 to the lap length in metres without a seam', () => {
  const track = Track.preset('oval');
  const { uvs } = buildRoadStrip(track);
  const vs = [];
  for (let k = 0; k < uvs.length; k += 4) vs.push(uvs[k + 1]);
  assert.equal(vs[0], 0);
  for (let k = 1; k < vs.length; k++) assert.ok(vs[k] > vs[k - 1]);
  assert.ok(Math.abs(vs[vs.length - 1] - track.n * 10 * SCALE) < track.n * SCALE); // ~ n × 10 units
});

test('barriers are vertical quads with alternating red and white stripes', () => {
  const track = Track.preset('classic');
  const { positions, colors, indices } = buildBarrier(track.outer, BARRIER_HEIGHT);
  const n = track.n;
  assert.equal(positions.length / 3, 4 * n);
  assert.equal(indices.length, 6 * n);
  for (const i of indices) assert.ok(i < 4 * n);
  // Bottom at 0, top at BARRIER_HEIGHT.
  assert.equal(positions[1], 0);
  assert.ok(Math.abs(positions[3 * 3 + 1] - BARRIER_HEIGHT) < 1e-6);
  const segmentColor = (s) => Array.from(colors.subarray(s * 12, s * 12 + 3));
  const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-6);
  assert.ok(near(segmentColor(0), BARRIER_COLORS.red));
  assert.ok(near(segmentColor(2), BARRIER_COLORS.white));
  let changes = 0;
  for (let s = 1; s < n; s++) if (!near(segmentColor(s), segmentColor(s - 1))) changes++;
  assert.ok(changes >= n / 3, `only ${changes} colour changes`);
  assert.deepEqual(barrierColor(0), BARRIER_COLORS.red);
  assert.deepEqual(barrierColor(2), BARRIER_COLORS.white);
});

test('start line is 16 up-facing checker quads across the road at index 0', () => {
  for (const name of Object.keys(PRESETS)) {
    const { positions, colors, indices } = buildStartLine(Track.preset(name));
    assert.equal(positions.length / 3, 64);
    assert.equal(colors.length, 64 * 3);
    assert.equal(indices.length, 96);
    for (let t = 0; t < indices.length; t += 3) {
      assert.ok(normalY(positions, indices[t], indices[t + 1], indices[t + 2]) > 0);
    }
  }
});

test('trackBounds3 gives the track extent in metres', () => {
  const track = Track.preset('oval');
  const b = track.bounds();
  const b3 = trackBounds3(track);
  assert.ok(Math.abs(b3.minX - b.minX * SCALE) < 1e-12);
  assert.ok(Math.abs(b3.maxZ - b.maxY * SCALE) < 1e-12);
  assert.ok(Math.abs(b3.size - Math.max(b.maxX - b.minX, b.maxY - b.minY) * SCALE) < 1e-12);
});

const ZOOM_LIMITS = { min: 0.15, max: 1, speed: 0.0015 };
const ZOOM_BOUNDS = { minX: 0, maxX: 60, minZ: 0, maxZ: 40, cx: 30, cz: 20, size: 60 };

test('top camera wheel: scrolling up zooms in towards the cursor, down zooms out', () => {
  const start = { zoom: 1, x: 30, z: 20 };
  const cursor = { x: 50, z: 30 };
  const closer = zoomTopCamera(start, cursor, -200, ZOOM_BOUNDS, ZOOM_LIMITS);
  assert.ok(closer.zoom < 1);
  // The focus moved towards the cursor by the zoom ratio, so the cursor point stays put.
  assert.ok(Math.abs(closer.x - (50 + (30 - 50) * closer.zoom)) < 1e-9);
  assert.ok(Math.abs(closer.z - (30 + (20 - 30) * closer.zoom)) < 1e-9);
  const farther = zoomTopCamera(closer, cursor, 100, ZOOM_BOUNDS, ZOOM_LIMITS);
  assert.ok(farther.zoom > closer.zoom);
});

test('top camera wheel: zoom is clamped and full zoom-out recentres on the track', () => {
  const deep = zoomTopCamera({ zoom: 1, x: 30, z: 20 }, { x: 59, z: 39 }, -1e6, ZOOM_BOUNDS, ZOOM_LIMITS);
  assert.equal(deep.zoom, ZOOM_LIMITS.min);
  assert.ok(deep.x <= ZOOM_BOUNDS.maxX && deep.z <= ZOOM_BOUNDS.maxZ);
  const out = zoomTopCamera({ zoom: 0.3, x: 55, z: 5 }, { x: 0, z: 0 }, 1e6, ZOOM_BOUNDS, ZOOM_LIMITS);
  assert.deepEqual(out, { zoom: 1, x: 30, z: 20 });
});

test('top camera wheel: the focus never leaves the track bounds', () => {
  const view = zoomTopCamera({ zoom: 0.5, x: 58, z: 38 }, { x: 500, z: 500 }, -300, ZOOM_BOUNDS, ZOOM_LIMITS);
  assert.ok(view.x <= 60 && view.z <= 40);
});
