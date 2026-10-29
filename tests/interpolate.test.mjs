import { test } from 'node:test';
import assert from 'node:assert/strict';

import { carPose } from '../src/ui/interpolate.js';
import { FixedStepper } from '../src/ui/fixedStep.js';
import { Car } from '../src/core/car.js';
import { Track } from '../src/core/track.js';

const oval = Track.preset('oval');

test('a car keeps its pose from before the latest step', () => {
  const car = new Car(oval);
  assert.deepEqual([car.prevX, car.prevY, car.prevAngle], [car.x, car.y, car.angle]);
  for (let s = 0; s < 20; s++) car.update(1, 0.3);
  const before = [car.x, car.y, car.angle];
  car.update(1, 0.3);
  assert.deepEqual([car.prevX, car.prevY, car.prevAngle], before);
  car.reset();
  assert.deepEqual([car.prevX, car.prevY], [car.x, car.y]);
});

test('carPose draws a moving car between its two steps', () => {
  const car = { x: 10, y: 20, angle: 1, prevX: 6, prevY: 16, prevAngle: 0.5, alive: true, finished: false };
  const out = { x: 0, y: 0, angle: 0 };
  assert.equal(carPose(car, 0.25, out), out);
  assert.deepEqual(out, { x: 7, y: 17, angle: 0.625 });
  assert.deepEqual(carPose(car, 0, out), { x: 6, y: 16, angle: 0.5 });
  assert.deepEqual(carPose(car, 1, out), { x: 10, y: 20, angle: 1 });
  assert.deepEqual(carPose(car, -0.5, out), { x: 6, y: 16, angle: 0.5 }, 'clamped');
});

test('carPose draws stopped cars where they are', () => {
  const out = { x: 0, y: 0, angle: 0 };
  const crashed = { x: 10, y: 20, angle: 1, prevX: 6, prevY: 16, prevAngle: 0.5, alive: false, finished: false };
  assert.deepEqual(carPose(crashed, 0.5, out), { x: 10, y: 20, angle: 1 });
  const finished = { ...crashed, alive: true, finished: true };
  assert.deepEqual(carPose(finished, 0.5, out), { x: 10, y: 20, angle: 1 });
});

test('the stepper reports how far the leftover time is into the next step', () => {
  const stepper = new FixedStepper({ stepMs: 10 });
  assert.equal(stepper.advance(25), 2);
  assert.equal(stepper.alpha, 0.5);
  stepper.reset();
  assert.equal(stepper.alpha, 0);
});
