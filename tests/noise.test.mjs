import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Car } from '../src/core/car.js';
import { Track } from '../src/core/track.js';
import { Simulation, driveBrain } from '../src/core/simulation.js';
import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { PRETRAINED_BRAIN } from '../src/core/pretrained.js';
import { mulberry32 } from '../src/core/math.js';
import {
  parseGeneralization,
  runGeneralization,
  summarizeNoise,
  generalizationColumns,
  GENERALIZATION_COLUMNS,
} from '../scripts/lib/generalization.mjs';

const oval = Track.preset('oval');

test('noisy readings stay within ±noise of the exact ones and inside 0..1', () => {
  const exact = new Car(oval);
  const noisy = new Car(oval, { sensorNoise: 0.1, noiseRng: mulberry32(1) });
  let differs = false;
  for (let k = 0; k < 50; k++) {
    noisy.sense();
    for (let r = 0; r < exact.sensors.length; r++) {
      const diff = noisy.sensors[r] - exact.sensors[r];
      assert.ok(Math.abs(diff) <= 0.1 + 1e-12);
      assert.ok(noisy.sensors[r] >= 0 && noisy.sensors[r] <= 1);
      assert.equal(noisy.inputs[r], noisy.sensors[r]);
      if (diff !== 0) differs = true;
    }
  }
  assert.ok(differs);
  assert.deepEqual([...noisy.rayEnds], [...exact.rayEnds], 'the drawn rays stay exact');
});

test('noise without a seeded RNG is refused (no Math.random fallback)', () => {
  assert.throws(() => new Car(oval, { sensorNoise: 0.1 }), /seeded noiseRng/);
});

test('a noisy drive is reproducible from its noise seed and differs from an exact one', () => {
  const brain = NeuralNetwork.fromJSON(PRETRAINED_BRAIN);
  const technical = Track.preset('technical');
  const a = driveBrain(brain, technical, { sensorNoise: 0.2, noiseSeed: 7 });
  const b = driveBrain(brain, technical, { sensorNoise: 0.2, noiseSeed: 7 });
  assert.deepEqual(a, b);
  const exact = driveBrain(brain, technical);
  assert.notDeepEqual(a.lapSteps, exact.lapSteps);
  assert.deepEqual(driveBrain(brain, technical, { sensorNoise: 0 }), exact);
});

test('noise uses its own RNG: a noisy training breeds from the same random stream', () => {
  const exact = new Simulation(oval, { seed: 5, populationSize: 10 });
  const noisy = new Simulation(oval, { seed: 5, populationSize: 10, sensorNoise: 0.1 });
  // Same initial brains: noise did not consume the main RNG.
  assert.deepEqual([...noisy.brains[3].weights[0]], [...exact.brains[3].weights[0]]);
  exact.runGenerations(2);
  noisy.runGenerations(2);
  assert.notDeepEqual(noisy.history, exact.history, 'the noise does change what the cars do');
});

test('a noise experiment drives every track at every level and summarizes per level', () => {
  const shipped = parseGeneralization(JSON.parse(readFileSync('experiments/sensor-noise.json', 'utf8')));
  assert.deepEqual(shipped.testNoise, [0, 0.05, 0.1, 0.2]);
  assert.equal(shipped.conditions[1].config.sensorNoise, 0.1);
  const def = parseGeneralization({
    ...shipped,
    generations: 2,
    population: 10,
    seeds: [1],
    testNoise: [0, 0.2],
    testTracks: { square: shipped.testTracks.square },
  });
  const rows = runGeneralization(def, def.conditions[1], 1);
  assert.equal(rows.length, 2 * (3 + 1)); // levels × (training + test tracks)
  assert.deepEqual([...new Set(rows.map((r) => r.testNoise))], [0, 0.2]);
  assert.ok(generalizationColumns(def).includes('testNoise'));
  assert.equal(generalizationColumns({ testNoise: null }), GENERALIZATION_COLUMNS);
  const [s] = summarizeNoise(rows, { ...def, conditions: [def.conditions[1]] });
  assert.deepEqual(s.levels.map((l) => [l.level, l.train.drives, l.test.drives]), [[0, 3, 1], [0.2, 3, 1]]);
  assert.throws(() => parseGeneralization({ ...shipped, testNoise: [1.5] }), /testNoise levels/);
});
