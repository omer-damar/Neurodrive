import { test } from 'node:test';
import assert from 'node:assert/strict';

import { t, setLocale, getLocale, LOCALES, DEFAULT_LOCALE, messageKeys } from '../src/ui/i18n.js';

test('every locale defines exactly the same message keys', () => {
  const reference = messageKeys(DEFAULT_LOCALE).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(messageKeys(locale).sort(), reference, `keys differ in ${locale}`);
  }
});

test('Turkish is the default and English is available', () => {
  assert.equal(DEFAULT_LOCALE, 'tr');
  assert.ok(LOCALES.includes('en'));
});

test('setLocale switches messages and ignores unknown locales', () => {
  setLocale('en');
  assert.equal(t('controls.play'), 'Start');
  setLocale('xx');
  assert.equal(getLocale(), 'en');
  setLocale('tr');
  assert.equal(t('controls.play'), 'Başlat');
});

test('t fills placeholders and returns unknown keys unchanged', () => {
  setLocale('tr');
  assert.equal(t('unit.seconds', { value: '8.74' }), '8.74 sn');
  assert.equal(t('network.sensor', { n: 3 }), 'S3');
  assert.equal(t('chart.tooltip'), 'Nesil {generation}'); // missing params stay visible
  assert.equal(t('no.such.key'), 'no.such.key');
});
