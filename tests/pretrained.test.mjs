import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { Track } from '../src/core/track.js';
import { TRACK_PRESETS, RAY_COUNT, HIDDEN_NEURONS } from '../src/core/config.js';
import { Simulation, driveBrain, configForBrain } from '../src/core/simulation.js';
import { PRETRAINED_BRAIN, PRETRAINED_INFO } from '../src/core/pretrained.js';

const pretrained = () => NeuralNetwork.fromJSON(PRETRAINED_BRAIN);

// Phase 6 acceptance: the pretrained brain completes at least one lap on every preset.
for (const name of TRACK_PRESETS) {
  test(`the pretrained brain completes a lap on ${name} without learning`, () => {
    const result = driveBrain(pretrained(), Track.preset(name));
    assert.ok(result.laps >= 1, `laps on ${name}: ${result.laps} (${result.deathCause})`);
  });
}

test('the pretrained brain uses the default network shape and records how it was made', () => {
  assert.deepEqual(configForBrain(pretrained()), {
    hiddenNeurons: HIDDEN_NEURONS,
    rayCount: RAY_COUNT,
    rayRange: PRETRAINED_BRAIN.sensor.rayRange,
    raySpread: PRETRAINED_BRAIN.sensor.raySpread,
  });
  assert.ok(PRETRAINED_INFO.generations > 0 && Array.isArray(PRETRAINED_INFO.tracks));
});

test('driveBrain is deterministic and stops at maxSteps', () => {
  const track = Track.preset('classic');
  assert.deepEqual(driveBrain(pretrained(), track), driveBrain(pretrained(), track));
  const short = driveBrain(pretrained(), track, { maxSteps: 50 });
  assert.equal(short.steps, 50);
  assert.equal(short.laps, 0);
});

test('configForBrain rejects networks the simulation cannot run', () => {
  const sensor = { rayCount: 7, rayRange: 200, raySpread: 2 };
  assert.equal(configForBrain(new NeuralNetwork([8, 6, 4, 2], null, sensor)), null);
  assert.equal(configForBrain(new NeuralNetwork([8, 6, 3], null, sensor)), null);
});

test('a population seeded from a brain with another shape runs with that shape', () => {
  const sensor = { rayCount: 5, rayRange: 180, raySpread: 2 };
  const brain = new NeuralNetwork([6, 10, 2], () => 0.3, sensor);
  const sim = new Simulation(Track.preset('oval'), { ...configForBrain(brain), populationSize: 20 });
  sim.seedFrom(brain);
  assert.deepEqual(sim.brains[0].toJSON(), brain.toJSON());
  assert.equal(sim.cars[0].sensors.length, 5);
  sim.step(); // the new shape feeds forward without errors
  assert.equal(sim.brains[1].sizes[1], 10);
});
