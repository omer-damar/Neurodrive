import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { mulberry32 } from '../src/core/math.js';

const SIZES = [8, 6, 2];
const INPUT = [0.1, 0.9, 0, 0.5, 0.3, 0.7, 0.2, 0.4];

function genes(net) {
  return [...net.weights, ...net.biases].flatMap((g) => Array.from(g));
}

test('output has one value per output neuron, all within tanh range', () => {
  const net = new NeuralNetwork(SIZES, mulberry32(1));
  const out = net.feedForward(INPUT);
  assert.equal(out.length, 2);
  for (const v of out) assert.ok(v >= -1 && v <= 1);
});

test('weights start in U(-1, 1) and the gene count matches the layer sizes', () => {
  const net = new NeuralNetwork(SIZES, mulberry32(1));
  const all = genes(net);
  assert.equal(all.length, 8 * 6 + 6 + 6 * 2 + 2);
  for (const g of all) assert.ok(g >= -1 && g < 1);
});

test('the same seed gives the same network and the same output', () => {
  const a = new NeuralNetwork(SIZES, mulberry32(42));
  const b = new NeuralNetwork(SIZES, mulberry32(42));
  assert.deepEqual(genes(a), genes(b));
  assert.deepEqual(Array.from(a.feedForward(INPUT)), Array.from(b.feedForward(INPUT)));
  assert.notDeepEqual(genes(a), genes(new NeuralNetwork(SIZES, mulberry32(43))));
});

test('feedForward keeps every layer activation for visualization', () => {
  const net = new NeuralNetwork(SIZES, mulberry32(5));
  net.feedForward(INPUT);
  assert.deepEqual(Array.from(net.activations[0]), INPUT);
  assert.equal(net.activations[1].length, 6);
});

test('JSON round trip gives identical outputs and keeps the sensor layout', () => {
  const net = new NeuralNetwork(SIZES, mulberry32(9), { rayCount: 7, rayRange: 180, raySpread: 2 });
  const copy = NeuralNetwork.fromJSON(JSON.parse(JSON.stringify(net.toJSON())));
  assert.deepEqual(Array.from(copy.feedForward(INPUT)), Array.from(net.feedForward(INPUT)));
  assert.deepEqual(copy.sensor, { rayCount: 7, rayRange: 180, raySpread: 2 });
  assert.equal(net.toJSON().version, 1);
});

test('fromJSON rejects an unknown format version', () => {
  const json = new NeuralNetwork(SIZES, mulberry32(9)).toJSON();
  assert.throws(() => NeuralNetwork.fromJSON({ ...json, version: 99 }));
});

test('clone is an independent copy', () => {
  const net = new NeuralNetwork(SIZES, mulberry32(3));
  const copy = net.clone();
  assert.deepEqual(genes(copy), genes(net));
  copy.weights[0][0] += 1;
  assert.notEqual(copy.weights[0][0], net.weights[0][0]);
});

test('mutate with rate 0 changes nothing; rate 1 changes every gene', () => {
  const net = new NeuralNetwork(SIZES, mulberry32(4));
  const before = genes(net);
  net.mutate(0, 0.5, mulberry32(10));
  assert.deepEqual(genes(net), before);

  net.mutate(1, 0.5, mulberry32(10));
  const after = genes(net);
  assert.ok(after.every((g, i) => g !== before[i]));
});

test('crossover takes every gene from one of the two parents, and from both overall', () => {
  const a = new NeuralNetwork(SIZES, mulberry32(1));
  const b = new NeuralNetwork(SIZES, mulberry32(2));
  const child = NeuralNetwork.crossover(a, b, mulberry32(7));
  const ga = genes(a);
  const gb = genes(b);
  const gc = genes(child);
  let fromA = 0;
  let fromB = 0;
  gc.forEach((g, i) => {
    assert.ok(g === ga[i] || g === gb[i], `gene ${i} from neither parent`);
    if (g === ga[i]) fromA++;
    if (g === gb[i]) fromB++;
  });
  assert.ok(fromA > 0 && fromB > 0);
});
