import { test } from 'node:test';
import assert from 'node:assert/strict';

import { niceScale, yTicks, xOf, indexAt, CHART_COLORS } from '../src/ui/chart.js';
import { layoutNetwork, NETWORK_COLORS } from '../src/ui/networkView.js';

test('niceScale picks a 1-2-5 step and the smallest multiple covering the peak', () => {
  assert.deepEqual(niceScale(0), { max: 1, step: 0.25 });
  assert.deepEqual(niceScale(-3), { max: 1, step: 0.25 });
  assert.deepEqual(niceScale(3.6), { max: 4, step: 1 }); // a typical 3-lap fitness
  assert.deepEqual(niceScale(4), { max: 4, step: 1 });
  assert.deepEqual(niceScale(0.7), { max: 0.8, step: 0.2 });
  assert.deepEqual(niceScale(42), { max: 60, step: 20 }); // 42 / 4 = 10.5 rounds up to a step of 20
});

test('yTicks lists round values from 0 to max', () => {
  assert.deepEqual(yTicks({ max: 4, step: 1 }), [0, 1, 2, 3, 4]);
  assert.deepEqual(yTicks({ max: 0.8, step: 0.2 }), [0, 0.2, 0.4, 0.6, 0.8]);
});

test('xOf and indexAt are inverse on the data points', () => {
  const n = 11;
  for (let i = 0; i < n; i++) assert.equal(indexAt(xOf(i, n, 30, 200), n, 30, 200), i);
  assert.equal(indexAt(-50, n, 30, 200), 0);
  assert.equal(indexAt(999, n, 30, 200), n - 1);
  assert.equal(indexAt(100, 0, 30, 200), -1);
  assert.equal(xOf(0, 1, 30, 200), 130); // a single point sits in the middle
});

test('chart series use the two first hues of the validated palette (dark steps)', () => {
  assert.deepEqual(CHART_COLORS, { best: '#3987e5', avg: '#d95926' });
});

test('layoutNetwork places one column per layer, centred and inside the canvas', () => {
  const padding = { left: 60, right: 70, top: 10, bottom: 10 };
  const { layers, radius } = layoutNetwork([8, 6, 2], 300, 190, padding);
  assert.deepEqual(layers.map((layer) => layer.length), [8, 6, 2]);
  assert.equal(layers[0][0].x, 60);
  assert.equal(layers[2][0].x, 230);
  for (const layer of layers) {
    const mid = (layer[0].y + layer[layer.length - 1].y) / 2;
    assert.ok(Math.abs(mid - 95) < 1e-9, 'layer centred vertically');
    for (const node of layer) assert.ok(node.y - radius >= 0 && node.y + radius <= 190);
  }
});

test('layoutNetwork fits the largest settings (9 rays + speed, 16 hidden)', () => {
  const { layers, radius } = layoutNetwork([10, 16, 2], 290, 190);
  assert.ok(radius >= 2);
  const hidden = layers[1];
  assert.ok(hidden[0].y >= 10 && hidden[15].y <= 180);
});

test('network colours: positive and negative hues around a neutral grey', () => {
  assert.equal(NETWORK_COLORS.positive.length, 3);
  assert.notDeepEqual(NETWORK_COLORS.positive, NETWORK_COLORS.negative);
});
