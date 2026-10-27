import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as config from '../src/core/config.js';

test('config loads with numeric constants', () => {
  assert.equal(config.DT, 1 / 60);
  assert.equal(config.RAY_COUNT, 7);
  assert.equal(config.SCALE, 0.05);
});

test('max speed stays below car length (no wall tunnelling)', () => {
  assert.ok(config.MAX_SPEED < config.CAR_LENGTH);
});

test('importmap pins the same three.js version as config', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes(`three@${config.THREE_VERSION}/build/three.module.js`));
  assert.ok(html.includes(`three@${config.THREE_VERSION}/examples/jsm/`));
});
