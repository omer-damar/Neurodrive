import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { mulberry32 } from '../src/core/math.js';
import { saveBrain, loadSavedBrain, hasSavedBrain, parseBrain, brainToText, BRAIN_STORAGE_KEY } from '../src/ui/storage.js';

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

const blocked = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

function sampleBrain() {
  return new NeuralNetwork([8, 6, 2], mulberry32(11), { rayCount: 7, rayRange: 200, raySpread: 2.356 });
}

test('a saved brain loads back and gives the same outputs for the same inputs', () => {
  const storage = new MemoryStorage();
  const brain = sampleBrain();
  assert.equal(hasSavedBrain(storage), false);
  assert.equal(saveBrain(brain, storage), true);
  assert.equal(hasSavedBrain(storage), true);
  const loaded = loadSavedBrain(storage);
  const inputs = [0, 0.2, 0.9, 0.4, 0.1, 0.7, 0, 0.6];
  assert.deepEqual(Array.from(loaded.feedForward(inputs)), Array.from(brain.feedForward(inputs)));
  assert.deepEqual(loaded.sensor, brain.sensor);
});

test('blocked or missing storage fails softly', () => {
  assert.equal(saveBrain(sampleBrain(), blocked), false);
  assert.equal(loadSavedBrain(blocked), null);
  assert.equal(hasSavedBrain(blocked), false);
  assert.equal(saveBrain(sampleBrain(), null), false);
  assert.equal(loadSavedBrain(null), null);
});

test('a corrupt saved brain reads as none', () => {
  const storage = new MemoryStorage();
  storage.setItem(BRAIN_STORAGE_KEY, '{not json');
  assert.equal(loadSavedBrain(storage), null);
});

test('a downloaded file parses back to the same network', () => {
  const brain = sampleBrain();
  const copy = parseBrain(brainToText(brain));
  assert.deepEqual(copy.toJSON(), brain.toJSON());
});

test('parseBrain rejects files that are not brains', () => {
  const good = sampleBrain().toJSON();
  const bad = [
    'not json',
    JSON.stringify({ hello: 'world' }),
    JSON.stringify({ ...good, version: 99 }),
    JSON.stringify({ ...good, sizes: [8, -6, 2] }),
    JSON.stringify({ ...good, weights: [good.weights[0].slice(1), good.weights[1]] }),
    JSON.stringify({ ...good, biases: [good.biases[0], [1, 'x']] }),
    JSON.stringify({ ...good, sensor: { ...good.sensor, rayCount: 5 } }),
  ];
  for (const text of bad) assert.throws(() => parseBrain(text), undefined, text.slice(0, 40));
});
