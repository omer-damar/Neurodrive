import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Track, PRESETS, TRACK_ERRORS, signedArea } from '../src/core/track.js';
import { RESAMPLE_SPACING, TRACK_WIDTH, WORLD_WIDTH, WORLD_HEIGHT } from '../src/core/config.js';

for (const name of Object.keys(PRESETS)) {
  test(`preset "${name}" passes validate() and fits the world`, () => {
    const track = Track.preset(name);
    assert.deepEqual(track.validate(), { ok: true });
    const b = track.bounds();
    assert.ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= WORLD_WIDTH && b.maxY <= WORLD_HEIGHT, JSON.stringify(b));
  });
}

test('centre points are evenly spaced at about RESAMPLE_SPACING', () => {
  const track = Track.preset('classic');
  const c = track.center;
  for (let i = 0; i < track.n; i++) {
    const j = (i + 1) % track.n;
    const d = Math.hypot(c[j * 2] - c[i * 2], c[j * 2 + 1] - c[i * 2 + 1]);
    assert.ok(Math.abs(d - RESAMPLE_SPACING) < 1, `gap ${d} at ${i}`);
  }
});

test('walls sit half a track width either side of the centre line', () => {
  const track = Track.preset('oval');
  for (let i = 0; i < track.n; i++) {
    const w = Math.hypot(track.outer[i * 2] - track.inner[i * 2], track.outer[i * 2 + 1] - track.inner[i * 2 + 1]);
    assert.ok(Math.abs(w - TRACK_WIDTH) < 1e-9);
  }
});

test('either winding gives the same track with inner wall inside', () => {
  const points = PRESETS.classic;
  const reversed = [points[0], ...points.slice(1).reverse()];
  const a = new Track(points);
  const b = new Track(reversed);
  assert.deepEqual(a.controlPoints, b.controlPoints);
  assert.ok(signedArea(a.controlPoints) > 0);
  assert.deepEqual(b.validate(), { ok: true });

  const area = (flat) => signedArea(Array.from({ length: flat.length / 2 }, (_, i) => [flat[i * 2], flat[i * 2 + 1]]));
  assert.ok(area(a.inner) < area(a.outer), 'inner wall encloses less than outer wall');
});

test('a turn tighter than the track is rejected as SHARP_TURN', () => {
  const track = new Track([[100, 100], [1100, 100], [150, 160], [1100, 700], [100, 700]]);
  assert.deepEqual(track.validate(), { ok: false, error: TRACK_ERRORS.SHARP_TURN });
});

test('overlapping track sections are rejected as SECTIONS_TOO_CLOSE', () => {
  // The bottom side bulges up until it overlaps the top straight.
  const dented = new Track([
    [200, 100], [600, 100], [1000, 100], [1100, 300], [1000, 520], [850, 450],
    [700, 180], [500, 180], [350, 450], [200, 520], [100, 300],
  ]);
  assert.deepEqual(dented.validate(), { ok: false, error: TRACK_ERRORS.SECTIONS_TOO_CLOSE });

  // A loop thinner than the track: the inner wall turns inside out without crossing.
  const thin = new Track([[100, 400], [600, 385], [1100, 400], [600, 415]]);
  assert.deepEqual(thin.validate(), { ok: false, error: TRACK_ERRORS.SECTIONS_TOO_CLOSE });
});

test('too few control points are rejected', () => {
  const track = new Track([[100, 100], [900, 100], [500, 700]]);
  assert.deepEqual(track.validate(), { ok: false, error: TRACK_ERRORS.TOO_FEW_POINTS });
});

test('nearestIndex wraps around the start and only searches near the hint', () => {
  const track = Track.preset('oval');
  const n = track.n;
  const c = track.center;
  assert.equal(track.nearestIndex(c[(n - 2) * 2], c[(n - 2) * 2 + 1], 1), n - 2);
  assert.equal(track.nearestIndex(c[3 * 2], c[3 * 2 + 1], n - 1), 3);
  // A point on the far side of the loop is out of the window: the result stays near the hint.
  const far = Math.floor(n / 2);
  const idx = track.nearestIndex(c[far * 2], c[far * 2 + 1], 0);
  assert.ok(idx <= 8 || idx >= n - 8, `got ${idx}`);
});

test('toJSON / fromJSON round trip keeps the geometry', () => {
  const a = Track.preset('technical');
  const b = Track.fromJSON(JSON.parse(JSON.stringify(a.toJSON())));
  assert.equal(b.n, a.n);
  assert.deepEqual(Array.from(b.center), Array.from(a.center));
  assert.equal(b.width, a.width);
});

test('start pose is the first centre point facing the second', () => {
  const track = Track.preset('classic');
  const c = track.center;
  assert.equal(track.startX, c[0]);
  assert.equal(track.startY, c[1]);
  assert.equal(track.startAngle, Math.atan2(c[3] - c[1], c[2] - c[0]));
});
