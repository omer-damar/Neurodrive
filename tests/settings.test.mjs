import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SETTINGS_LIMITS, MAX_POPULATION } from '../src/core/config.js';
import { DEFAULT_SIM_CONFIG } from '../src/core/simulation.js';
import { SETTING_NAMES, defaultSettings, clampSetting, formatSetting, sameSettings } from '../src/ui/settings.js';

test('settings cover the four training parameters with the planned ranges', () => {
  assert.deepEqual([...SETTING_NAMES].sort(), ['hiddenNeurons', 'mutationRate', 'populationSize', 'rayCount']);
  assert.deepEqual(SETTINGS_LIMITS.populationSize.slice(0, 2), [20, 300]);
  assert.deepEqual(SETTINGS_LIMITS.mutationRate.slice(0, 2), [0.01, 0.5]);
  assert.deepEqual(SETTINGS_LIMITS.hiddenNeurons.slice(0, 2), [4, 16]);
  assert.deepEqual(SETTINGS_LIMITS.rayCount.slice(0, 2), [3, 9]);
  assert.equal(MAX_POPULATION, 300);
});

test('defaults come from the simulation config and lie inside the limits', () => {
  const defaults = defaultSettings();
  for (const name of SETTING_NAMES) {
    const [min, max] = SETTINGS_LIMITS[name];
    assert.equal(defaults[name], DEFAULT_SIM_CONFIG[name]);
    assert.ok(defaults[name] >= min && defaults[name] <= max, name);
  }
});

test('clampSetting clamps, snaps to the step and rejects junk', () => {
  assert.equal(clampSetting('populationSize', 5), 20);
  assert.equal(clampSetting('populationSize', 999), 300);
  assert.equal(clampSetting('populationSize', '134'), 130);
  assert.equal(clampSetting('mutationRate', 0.123), 0.12);
  assert.equal(clampSetting('mutationRate', '0.3'), 0.3); // no float noise like 0.30000000000000004
  assert.equal(clampSetting('rayCount', 7.6), 8);
  assert.equal(clampSetting('hiddenNeurons', 'abc'), DEFAULT_SIM_CONFIG.hiddenNeurons);
});

test('formatSetting shows as many decimals as the step', () => {
  assert.equal(formatSetting('mutationRate', 0.1), '0.10');
  assert.equal(formatSetting('populationSize', 100), '100');
});

test('sameSettings compares every setting', () => {
  const a = defaultSettings();
  assert.ok(sameSettings(a, { ...a }));
  assert.ok(!sameSettings(a, { ...a, rayCount: 5 }));
});
