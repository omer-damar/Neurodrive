import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Simulation, fitnessOf } from '../src/core/simulation.js';
import { Track } from '../src/core/track.js';
import { Car } from '../src/core/car.js';
import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { mulberry32 } from '../src/core/math.js';

const oval = Track.preset('oval');

function genes(net) {
  return [...net.weights, ...net.biases].flatMap((g) => Array.from(g));
}

test('fitness is laps completed plus an early-finish bonus', () => {
  const car = new Car(oval);
  car.maxProgress = oval.n / 2;
  assert.equal(fitnessOf(car, 3600), 0.5);
  car.maxProgress = oval.n * 3;
  car.finished = true;
  car.finishStep = 1800;
  assert.equal(fitnessOf(car, 3600), 3.5);
});

test('a generation ends when every car has stopped, and the population size is kept', () => {
  const sim = new Simulation(oval, { populationSize: 20, seed: 1 });
  const stats = sim.runGenerations(2);
  assert.equal(sim.generation, 3);
  assert.equal(sim.brains.length, 20);
  assert.equal(sim.cars.length, 20);
  assert.equal(stats.length, 2);
  for (const s of stats) {
    assert.ok(s.best >= s.avg);
    assert.ok(Number.isFinite(s.avg));
  }
});

test('a generation never runs longer than maxSteps', () => {
  const sim = new Simulation(oval, { populationSize: 5, seed: 1, maxSteps: 50 });
  for (let i = 0; i < 50; i++) sim.step();
  assert.equal(sim.generation, 2);
  assert.equal(sim.generationStep, 0);
});

test('elites survive into the next generation unchanged', () => {
  const sim = new Simulation(oval, { populationSize: 20, seed: 3 });
  const before = sim.brains.map(genes);
  sim.runGenerations(1);
  const ranking = Array.from(sim.fitness) // fitness of the generation that just ended
    .map((f, i) => [f, i])
    .sort((a, b) => b[0] - a[0]);
  assert.deepEqual(genes(sim.brains[0]), before[ranking[0][1]]);
  assert.deepEqual(sim.parents[0], [ranking[0][1]]);
});

test('the same seed gives the same history', () => {
  const a = new Simulation(oval, { populationSize: 20, seed: 7 }).runGenerations(3);
  const b = new Simulation(oval, { populationSize: 20, seed: 7 }).runGenerations(3);
  assert.deepEqual(a, b);
});

test('the all-time best brain is kept and onGeneration fires', () => {
  const sim = new Simulation(oval, { populationSize: 20, seed: 2 });
  const seen = [];
  sim.onGeneration = (stats) => seen.push(stats.generation);
  sim.runGenerations(3);
  assert.deepEqual(seen, [1, 2, 3]);
  assert.ok(sim.bestBrain instanceof NeuralNetwork);
  assert.equal(sim.bestFitness, Math.max(...sim.history.map((s) => s.best)));
});

test('setTrack keeps the brains and restarts the cars on the new track', () => {
  const sim = new Simulation(oval, { populationSize: 10, seed: 4 });
  for (let i = 0; i < 30; i++) sim.step();
  const brains = sim.brains;
  const classic = Track.preset('classic');
  let changed = null;
  sim.onTrackChange = (track) => (changed = track);
  sim.setTrack(classic);
  assert.strictEqual(sim.brains, brains);
  assert.strictEqual(changed, classic);
  assert.equal(sim.generationStep, 0);
  for (const car of sim.cars) {
    assert.equal(car.x, classic.startX);
    assert.ok(car.alive);
  }
});

test('seedFrom starts the population from one brain plus mutated copies', () => {
  const sim = new Simulation(oval, { populationSize: 10, seed: 5 });
  const brain = new NeuralNetwork(sim.sizes, mulberry32(99), sim.sensor);
  sim.seedFrom(brain);
  assert.deepEqual(genes(sim.brains[0]), genes(brain));
  assert.notStrictEqual(sim.brains[0], brain);
  assert.notDeepEqual(genes(sim.brains[1]), genes(brain));
});

// Learning test: seed 42, oval, population 50, best fitness >= 1.0 within 30 generations.
test('cars learn to complete a lap on the oval', () => {
  const sim = new Simulation(oval, { populationSize: 50, seed: 42 });
  const history = sim.runGenerations(30);
  const best = Math.max(...history.map((s) => s.best));
  assert.ok(best >= 1, `best fitness after 30 generations: ${best}`);
});
