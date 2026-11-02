import { test } from 'node:test';
import assert from 'node:assert/strict';

import { edgeSignals, nodeAt, topSources, layoutNetwork } from '../src/ui/networkView.js';
import { NeuralNetwork } from '../src/core/neuralNetwork.js';

// [2, 2, 1] network with hand-set weights; activations as after one feedForward.
function tinyBrain() {
  const brain = new NeuralNetwork([2, 2, 1]);
  brain.weights[0].set([0.5, -2, 1, 1]); // hidden 0 <- (in0, in1), hidden 1 <- (in0, in1)
  brain.weights[1].set([3, -0.25]); // output <- (hidden 0, hidden 1)
  brain.feedForward([1, 0.5]);
  return brain;
}

test('edgeSignals is weight × source activation, laid out like the weights', () => {
  const brain = tinyBrain();
  const { signals, max } = edgeSignals(brain, 0);
  assert.deepEqual([...signals], [0.5, -1, 1, 0.5]);
  assert.equal(max, 1);
  const h = brain.activations[1];
  const out = edgeSignals(brain, 1);
  assert.deepEqual([...out.signals], [3 * h[0], -0.25 * h[1]]);
  const buffer = new Float64Array(4);
  assert.equal(edgeSignals(brain, 0, buffer).signals, buffer, 'reuses the given buffer');
});

test('a silent input sends no signal however large its weights', () => {
  const brain = new NeuralNetwork([2, 1, 1]);
  brain.weights[0].set([5, 5]);
  brain.feedForward([0, 0.2]);
  assert.deepEqual([...edgeSignals(brain, 0).signals], [0, 1]);
});

test('topSources lists the strongest incoming signals first; inputs have none', () => {
  const brain = tinyBrain();
  assert.deepEqual(topSources(brain, 1, 0).map((s) => [s.index, s.signal]), [[1, -1], [0, 0.5]]);
  assert.deepEqual(topSources(brain, 1, 0, 1).map((s) => s.index), [1]);
  assert.deepEqual(topSources(brain, 0, 1), []);
});

test('nodeAt finds the node under the pointer, with some slop, and nothing between nodes', () => {
  const layout = layoutNetwork([10, 16, 2], 290, 190);
  const node = layout.layers[1][5];
  assert.deepEqual(nodeAt(layout, node.x, node.y), { layer: 1, index: 5 });
  assert.deepEqual(nodeAt(layout, node.x + layout.radius + 2, node.y), { layer: 1, index: 5 });
  const a = layout.layers[0][0];
  const b = layout.layers[1][0];
  assert.equal(nodeAt(layout, (a.x + b.x) / 2, a.y), null);
  assert.equal(nodeAt(layout, -50, -50), null);
});
