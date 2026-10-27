import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nextGeneration, tournament } from '../src/core/genetics.js';
import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { mulberry32 } from '../src/core/math.js';

const SIZES = [8, 6, 2];

function population(count, seed = 1) {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => new NeuralNetwork(SIZES, rng));
}

function genes(net) {
  return [...net.weights, ...net.biases].flatMap((g) => Array.from(g));
}

test('population size is preserved', () => {
  for (const size of [5, 20, 100]) {
    const brains = population(size);
    const fitness = brains.map((_, i) => i);
    const { brains: next, parents } = nextGeneration(brains, fitness, mulberry32(2));
    assert.equal(next.length, size);
    assert.equal(parents.length, size);
  }
});

test('the two elites are copied unchanged, best first', () => {
  const brains = population(10);
  const fitness = [3, 9, 1, 7, 0, 2, 5, 4, 8, 6]; // best: index 1, then 8
  const { brains: next, parents, ranking } = nextGeneration(brains, fitness, mulberry32(3), { mutationRate: 1 });
  assert.deepEqual(ranking.slice(0, 2), [1, 8]);
  assert.deepEqual(genes(next[0]), genes(brains[1]));
  assert.deepEqual(genes(next[1]), genes(brains[8]));
  assert.deepEqual(parents.slice(0, 2), [[1], [8]]);
  assert.notStrictEqual(next[0], brains[1], 'elites are clones, not shared references');
});

test('children have two parents and differ from both when mutation is on', () => {
  const brains = population(10);
  const fitness = brains.map((_, i) => i);
  const { brains: next, parents } = nextGeneration(brains, fitness, mulberry32(4), { mutationRate: 1 });
  for (let i = 2; i < next.length; i++) {
    assert.equal(parents[i].length, 2);
    const g = genes(next[i]);
    for (const p of parents[i]) assert.notDeepEqual(g, genes(brains[p]));
  }
});

test('the same seed breeds the same generation', () => {
  const brains = population(20);
  const fitness = brains.map((_, i) => (i * 7) % 20);
  const a = nextGeneration(brains, fitness, mulberry32(9));
  const b = nextGeneration(brains, fitness, mulberry32(9));
  assert.deepEqual(a.brains.map(genes), b.brains.map(genes));
});

test('tournament selection favours fitter individuals', () => {
  const fitness = Array.from({ length: 100 }, (_, i) => i);
  const rng = mulberry32(5);
  let sum = 0;
  const draws = 2000;
  for (let i = 0; i < draws; i++) sum += tournament(fitness, 3, rng);
  // Uniform picks average ~49.5; best-of-3 averages ~74.
  assert.ok(sum / draws > 65, `mean winner ${sum / draws}`);
});
