import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SKETCH_POINT_SPACING, WORLD_WIDTH, WORLD_HEIGHT } from '../src/core/config.js';
import { TRACK_ERRORS } from '../src/core/track.js';
import { Simulation } from '../src/core/simulation.js';
import {
  thinStroke,
  clampToWorld,
  trackFromStroke,
  trackFromStored,
  resampleStroke,
  trimClosing,
  smoothLoop,
} from '../src/core/trackSketch.js';
import { mulberry32, gaussian } from '../src/core/math.js';
import { saveCustomTrack, loadCustomTrackJSON, TRACK_STORAGE_KEY } from '../src/ui/storage.js';

// A hand-drawn-like stroke: dense samples around an ellipse with a little wobble.
function ellipseStroke({ cx = 600, cy = 400, rx = 420, ry = 260, samples = 600, clockwise = false, wobble = 3 } = {}) {
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const a = (clockwise ? -1 : 1) * (i / samples) * Math.PI * 2;
    const w = wobble * Math.sin(i * 1.7);
    points.push([cx + (rx + w) * Math.cos(a), cy + (ry + w) * Math.sin(a)]);
  }
  return points;
}

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }
  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }
  setItem(key, value) {
    this.items.set(key, String(value));
  }
}

test('thinStroke keeps points at least the spacing apart and drops a closing duplicate', () => {
  const kept = thinStroke(ellipseStroke());
  for (let i = 1; i < kept.length; i++) {
    const d = Math.hypot(kept[i][0] - kept[i - 1][0], kept[i][1] - kept[i - 1][1]);
    assert.ok(d >= SKETCH_POINT_SPACING, `gap ${d}`);
  }
  const first = kept[0];
  const last = kept[kept.length - 1];
  assert.ok(Math.hypot(last[0] - first[0], last[1] - first[1]) >= SKETCH_POINT_SPACING, 'loop end is not a duplicate start');
  assert.deepEqual(thinStroke([]), []);
});

test('clampToWorld keeps drawn points inside the world', () => {
  assert.deepEqual(clampToWorld(-20, 50), [0, 50]);
  assert.deepEqual(clampToWorld(5000, 9000), [WORLD_WIDTH, WORLD_HEIGHT]);
});

test('a drawn loop becomes a valid track in either direction', () => {
  for (const clockwise of [false, true]) {
    const result = trackFromStroke(ellipseStroke({ clockwise }));
    assert.equal(result.ok, true, `clockwise=${clockwise}`);
    assert.ok(result.track.n > 100);
  }
});

test('too short a stroke is rejected', () => {
  const result = trackFromStroke([[100, 100], [110, 100], [120, 105]]);
  assert.deepEqual(result, { ok: false, error: TRACK_ERRORS.TOO_FEW_POINTS });
});

test('a figure eight is rejected because two parts of the road cross', () => {
  const points = [];
  for (let i = 0; i <= 800; i++) {
    const a = (i / 800) * Math.PI * 2;
    points.push([600 + 450 * Math.sin(a), 400 + 250 * Math.sin(a) * Math.cos(a)]);
  }
  assert.deepEqual(trackFromStroke(points), { ok: false, error: TRACK_ERRORS.SECTIONS_TOO_CLOSE });
});

test('a hairpin narrower than the road is rejected', () => {
  // Out along y = 300 and straight back along y = 330: the two halves overlap.
  const points = [];
  for (let x = 200; x <= 1000; x += 5) points.push([x, 300]);
  for (let x = 1000; x >= 200; x -= 5) points.push([x, 330]);
  const result = trackFromStroke(points);
  assert.equal(result.ok, false);
  assert.ok([TRACK_ERRORS.SHARP_TURN, TRACK_ERRORS.SECTIONS_TOO_CLOSE].includes(result.error));
});

test('training runs on a drawn track', () => {
  const { track } = trackFromStroke(ellipseStroke());
  const sim = new Simulation(track, { populationSize: 10 });
  for (let i = 0; i < 30; i++) sim.step();
  assert.equal(sim.cars.length, 10);
});

test('a custom track survives storage and comes back identical', () => {
  const storage = new MemoryStorage();
  const { track } = trackFromStroke(ellipseStroke());
  assert.equal(saveCustomTrack(track, storage), true);
  const copy = trackFromStored(loadCustomTrackJSON(storage));
  assert.deepEqual(copy.toJSON(), track.toJSON());
  assert.deepEqual(Array.from(copy.center), Array.from(track.center));
});

test('broken or invalid stored tracks are ignored', () => {
  const storage = new MemoryStorage();
  assert.equal(loadCustomTrackJSON(storage), null);
  storage.setItem(TRACK_STORAGE_KEY, '{broken');
  assert.equal(loadCustomTrackJSON(storage), null);
  assert.equal(trackFromStored(null), null);
  assert.equal(trackFromStored({ controlPoints: [[1, 2], [3, 'x'], [5, 6], [7, 8]] }), null);
  assert.equal(trackFromStored({ controlPoints: [[0, 0], [10, 0], [10, 10]] }), null);
  assert.equal(trackFromStored({ controlPoints: [[0, 0], [400, 0], [400, 300], [0, 300]], width: -5 }), null);
  // Valid shape but the road overlaps itself (points far too close for the road width).
  assert.equal(trackFromStored({ controlPoints: [[0, 0], [40, 0], [40, 30], [0, 30]] }), null);
});

// Hand-like stroke: a rounded rectangle with a wobbly hand (correlated noise), and options to draw
// past the start or stop short of it, as people do when closing a loop.
function handStroke({ seed = 1, jitter = 4, overshoot = 0, short = 0 } = {}) {
  const rng = mulberry32(seed);
  const corner = 110;
  const [x0, y0, w, h] = [200, 170, 800, 450];
  const path = [];
  const line = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let i = 0; i < n; i++) path.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  const arc = (cx, cy, a0) => {
    for (let i = 0; i < 20; i++) {
      const a = a0 + (i / 20) * (Math.PI / 2);
      path.push([cx + corner * Math.cos(a), cy + corner * Math.sin(a)]);
    }
  };
  line(x0 + corner, y0, x0 + w - corner, y0);
  arc(x0 + w - corner, y0 + corner, -Math.PI / 2);
  line(x0 + w, y0 + corner, x0 + w, y0 + h - corner);
  arc(x0 + w - corner, y0 + h - corner, 0);
  line(x0 + w - corner, y0 + h, x0 + corner, y0 + h);
  arc(x0 + corner, y0 + h - corner, Math.PI / 2);
  line(x0, y0 + h - corner, x0, y0 + corner);
  arc(x0 + corner, y0 + corner, Math.PI);
  const points = [];
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < path.length - short + overshoot; i++) {
    const [x, y] = path[i % path.length];
    dx = dx * 0.8 + gaussian(rng) * jitter;
    dy = dy * 0.8 + gaussian(rng) * jitter;
    points.push([x + dx, y + dy]);
  }
  return points;
}

test('wobbly hand-drawn loops become valid tracks', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const result = trackFromStroke(handStroke({ seed, jitter: 6 }));
    assert.equal(result.ok, true, `seed ${seed}: ${result.error}`);
  }
});

test('drawing past the start or stopping short still closes cleanly', () => {
  for (const options of [{ overshoot: 25 }, { short: 10 }, { overshoot: 10, jitter: 3 }]) {
    const result = trackFromStroke(handStroke(options));
    assert.equal(result.ok, true, JSON.stringify(options));
    assert.equal(result.passes, 1, 'no extra smoothing needed for the closing');
  }
});

test('smoothing keeps the drawn size: the track spans nearly the stroke width', () => {
  const stroke = handStroke({ jitter: 6 });
  const { track } = trackFromStroke(stroke);
  const xs = stroke.map((p) => p[0]);
  const drawn = Math.max(...xs) - Math.min(...xs);
  const bounds = track.bounds();
  const centreWidth = bounds.maxX - bounds.minX - track.width;
  assert.ok(Math.abs(centreWidth - drawn) / drawn < 0.06, `${centreWidth} vs ${drawn}`);
});

test('resampleStroke spaces points evenly along the stroke', () => {
  const out = resampleStroke([[0, 0], [3, 0], [25, 0], [25, 40]], 10);
  assert.deepEqual(out, [[0, 0], [10, 0], [20, 0], [25, 5], [25, 15], [25, 25], [25, 35]]);
});

test('trimClosing cuts an overshoot but not a figure eight passing its start halfway', () => {
  const loop = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 100) * Math.PI * 2; // 20 % past the start
    loop.push([600 + 300 * Math.cos(a), 400 + 200 * Math.sin(a)]);
  }
  assert.equal(trimClosing(loop).length, 101); // cut at the point back on the start
  const eight = [];
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    eight.push([600 + 400 * Math.sin(a), 400 + 200 * Math.sin(a) * Math.cos(a)]);
  }
  assert.equal(trimClosing(eight).length, 100);
});

test('smoothLoop keeps a closed loop centred and does not change its input', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const smooth = smoothLoop(square, 1, 3);
  const cx = smooth.reduce((sum, p) => sum + p[0], 0) / smooth.length;
  const cy = smooth.reduce((sum, p) => sum + p[1], 0) / smooth.length;
  assert.ok(Math.abs(cx - 5) < 1e-9 && Math.abs(cy - 5) < 1e-9);
  assert.deepEqual(square[1], [10, 0]);
});
