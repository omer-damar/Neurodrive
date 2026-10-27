import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FixedStepper } from '../src/ui/fixedStep.js';

function stepsInOneSecond(hz, speed = 1) {
  const stepper = new FixedStepper();
  let total = 0;
  for (let f = 0; f < hz; f++) total += stepper.advance(1000 / hz, speed);
  return total;
}

test('one second of real time is 60 steps at any refresh rate', () => {
  for (const hz of [30, 60, 75, 120, 144, 165]) {
    const steps = stepsInOneSecond(hz);
    assert.ok(Math.abs(steps - 60) <= 1, `${hz} Hz gave ${steps} steps`);
  }
});

test('the speed multiplier scales steps per second', () => {
  assert.ok(Math.abs(stepsInOneSecond(144, 5) - 300) <= 1);
});

test('a long pause is clamped and the backlog is dropped', () => {
  const stepper = new FixedStepper({ maxFrameMs: 100, maxStepsPerFrame: 4 });
  assert.equal(stepper.advance(10_000), 4);
  assert.equal(stepper.accumulator, 0);
  assert.equal(stepper.advance(1000 / 60), 1);
});
