import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Car, DEATH_CAUSES } from '../src/core/car.js';
import { Track } from '../src/core/track.js';
import { MAX_SPEED, STUCK_STEPS, LAPS, RAY_COUNT, RAY_RANGE } from '../src/core/config.js';
import { mulberry32, segmentIntersectT } from '../src/core/math.js';

const oval = Track.preset('oval');

// Teleports the car point by point along the centre line (k steps forward or backward).
function walk(car, steps, direction = 1) {
  const n = car.track.n;
  for (let k = 0; k < steps; k++) {
    const i = (((car.trackIdx + direction) % n) + n) % n;
    car.x = car.track.center[i * 2];
    car.y = car.track.center[i * 2 + 1];
    car.updateProgress();
  }
}

// Simple pursuit driver: steer towards a centre point a few indices ahead, hold a moderate speed.
function pursuit(car, lookAhead = 6, targetSpeed = 3) {
  const n = car.track.n;
  const i = (car.trackIdx + lookAhead) % n;
  const tx = car.track.center[i * 2] - car.x;
  const ty = car.track.center[i * 2 + 1] - car.y;
  let diff = Math.atan2(ty, tx) - car.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  car.update(car.speed < targetSpeed ? 1 : 0, diff * 4);
}

test('a car starts at the track start, alive and still', () => {
  const car = new Car(oval);
  assert.equal(car.x, oval.startX);
  assert.equal(car.y, oval.startY);
  assert.equal(car.angle, oval.startAngle);
  assert.equal(car.speed, 0);
  assert.ok(car.alive);
});

test('speed is capped at MAX_SPEED and never goes negative', () => {
  const car = new Car(oval, { stuckSteps: Infinity });
  for (let i = 0; i < 40; i++) pursuit(car, 6, Infinity);
  assert.ok(car.speed <= MAX_SPEED);
  for (let i = 0; i < 40; i++) car.update(-1, 0);
  assert.equal(car.speed, 0);
});

test('a car driving straight eventually hits a wall and stops', () => {
  const car = new Car(oval);
  for (let i = 0; i < 2000 && car.alive; i++) car.update(1, 0);
  assert.equal(car.alive, false);
  assert.equal(car.deathCause, DEATH_CAUSES.WALL);
  assert.equal(car.speed, 0);
  const { x, y } = car;
  car.update(1, 0);
  assert.equal(car.x, x, 'a dead car no longer moves');
  assert.equal(car.y, y);
});

test('progress grows by n for one lap and records the lap', () => {
  const car = new Car(oval);
  walk(car, oval.n);
  assert.equal(car.progress, oval.n);
  assert.equal(car.maxProgress, oval.n);
  assert.equal(car.lap, 1);
  assert.equal(car.lapSteps.length, 1);
  assert.ok(car.alive);
});

test('finishing LAPS laps marks the car finished', () => {
  const car = new Car(oval);
  walk(car, oval.n * LAPS);
  assert.ok(car.finished);
  assert.equal(car.lap, LAPS);
  assert.equal(car.lapSteps.length, LAPS);
  assert.equal(car.speed, 0);
});

test('driving backwards past the tolerance kills the car', () => {
  const car = new Car(oval);
  walk(car, 50);
  walk(car, 40, -1);
  assert.equal(car.alive, false);
  assert.equal(car.deathCause, DEATH_CAUSES.REVERSE);
});

test('standing still for too long kills the car, unless disabled', () => {
  const car = new Car(oval);
  for (let i = 0; i <= STUCK_STEPS + 1 && car.alive; i++) car.update(0, 0);
  assert.equal(car.deathCause, DEATH_CAUSES.STUCK);

  const human = new Car(oval, { stuckSteps: Infinity });
  for (let i = 0; i < STUCK_STEPS * 3; i++) human.update(0, 0);
  assert.ok(human.alive);
});

for (const name of ['oval', 'classic', 'technical']) {
  test(`a simple pursuit driver completes a lap on "${name}" without crashing`, () => {
    const track = Track.preset(name);
    const car = new Car(track);
    for (let i = 0; i < 3000 && car.alive && car.lap < 1; i++) pursuit(car);
    assert.ok(car.alive, `died: ${car.deathCause} at index ${car.trackIdx}`);
    assert.equal(car.lap, 1);
  });
}

test('reset puts the car back at the start', () => {
  const car = new Car(oval);
  for (let i = 0; i < 2000 && car.alive; i++) car.update(1, 0);
  car.reset();
  assert.ok(car.alive);
  assert.equal(car.x, oval.startX);
  assert.equal(car.progress, 0);
  assert.equal(car.lapSteps.length, 0);
});

test('sensors fill RAY_COUNT readings in [0, 1] plus normalized speed', () => {
  const car = new Car(oval);
  assert.equal(car.sensors.length, RAY_COUNT);
  assert.equal(car.inputs.length, RAY_COUNT + 1);
  for (const v of car.sensors) assert.ok(v >= 0 && v <= 1);
  car.speed = MAX_SPEED / 2;
  car.sense();
  assert.equal(car.inputs[RAY_COUNT], 0.5);
});

test('side rays see the walls close by; the forward ray on a straight sees nothing', () => {
  // Bottom of the oval (around 600, 660) is nearly straight; face along the road there.
  const car = new Car(oval);
  const i = oval.nearestIndex(600, 660, Math.floor(oval.n / 4));
  const j = (i + 1) % oval.n;
  car.x = oval.center[i * 2];
  car.y = oval.center[i * 2 + 1];
  car.angle = Math.atan2(oval.center[j * 2 + 1] - car.y, oval.center[j * 2] - car.x);
  car.sense();
  const half = oval.width / 2;
  const left = car.sensors[0];
  const right = car.sensors[RAY_COUNT - 1];
  // Outermost rays are ±67.5°, so the wall is about half / sin(67.5°) away.
  const expected = 1 - half / Math.sin((67.5 * Math.PI) / 180) / RAY_RANGE;
  assert.ok(Math.abs(left - expected) < 0.05, `left ${left}`);
  assert.ok(Math.abs(right - expected) < 0.05, `right ${right}`);
  assert.ok(car.sensors[Math.floor(RAY_COUNT / 2)] < 0.2, 'forward ray should be nearly clear');
});

test('grid-based sensing matches a brute-force scan over every wall', () => {
  const track = Track.preset('technical');
  const car = new Car(track);
  const rng = mulberry32(11);
  const s = track.segments;
  for (let trial = 0; trial < 40; trial++) {
    const i = Math.floor(rng() * track.n);
    car.x = track.center[i * 2] + (rng() - 0.5) * 30;
    car.y = track.center[i * 2 + 1] + (rng() - 0.5) * 30;
    car.angle = rng() * Math.PI * 2;
    car.sense();
    for (let r = 0; r < RAY_COUNT; r++) {
      const a = car.angle - car.raySpread / 2 + (car.raySpread * r) / (RAY_COUNT - 1);
      const ex = car.x + Math.cos(a) * RAY_RANGE;
      const ey = car.y + Math.sin(a) * RAY_RANGE;
      let nearest = 1;
      for (let o = 0; o < s.length; o += 4) {
        const t = segmentIntersectT(car.x, car.y, ex, ey, s[o], s[o + 1], s[o + 2], s[o + 3]);
        if (t >= 0 && t < nearest) nearest = t;
      }
      assert.ok(Math.abs(car.sensors[r] - (1 - nearest)) < 1e-12, `trial ${trial} ray ${r}`);
    }
  }
});

test('ray ends sit on the hit point, or at full range when clear', () => {
  const car = new Car(oval);
  for (let r = 0; r < RAY_COUNT; r++) {
    const d = Math.hypot(car.rayEnds[r * 2] - car.x, car.rayEnds[r * 2 + 1] - car.y);
    assert.ok(Math.abs(d - (1 - car.sensors[r]) * RAY_RANGE) < 1e-9);
  }
});
