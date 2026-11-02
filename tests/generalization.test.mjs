import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  parseGeneralization,
  buildTestTracks,
  trainingTrack,
  sharpestTurns,
  runGeneralization,
  summarizeGeneralization,
  GENERALIZATION_COLUMNS,
  GENERALIZATION_STRINGS,
} from '../scripts/lib/generalization.mjs';
import { trainOnTracks } from '../scripts/lib/training.mjs';
import { toCSV, fromCSV } from '../scripts/lib/experiment.mjs';
import { generalizationChartSVG, generalizationMarkdown } from '../scripts/lib/svg.mjs';
import { scoreOnTracks } from '../src/core/simulation.js';
import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { PRETRAINED_BRAIN } from '../src/core/pretrained.js';
import { Track, PRESETS } from '../src/core/track.js';

const SHIPPED = parseGeneralization(JSON.parse(readFileSync('experiments/generalization.json', 'utf8')));

const TINY = parseGeneralization({
  type: 'generalization',
  name: 'tiny',
  generations: 3,
  population: 10,
  seeds: [1, 2],
  conditions: [
    { name: 'single', tracks: ['oval'] },
    { name: 'rotating', tracks: ['oval', 'classic'] },
  ],
  testTracks: { triangle: SHIPPED.testTracks.triangle, square: SHIPPED.testTracks.square },
});

function runAll(def) {
  const tracks = buildTestTracks(def);
  return def.conditions.flatMap((c) => def.seeds.flatMap((seed) => runGeneralization(def, c, seed, tracks)));
}

test('the shipped definition is valid and its test tracks are new, valid tracks', () => {
  assert.equal(SHIPPED.conditions.length, 2);
  const tracks = buildTestTracks(SHIPPED);
  assert.equal(tracks.size, 5);
  for (const [name, track] of tracks) {
    assert.ok(!(name in PRESETS));
    assert.ok(track.validate().ok, name);
    for (const preset of Object.values(PRESETS)) assert.notDeepEqual(track.controlPoints, preset);
  }
});

test('parseGeneralization rejects presets as test tracks, unknown training tracks and missing keys', () => {
  const base = { name: 'x', generations: 1, seeds: [1], conditions: [{ name: 'a', tracks: ['oval'] }], testTracks: {} };
  assert.throws(() => parseGeneralization({ ...base, testTracks: { oval: PRESETS.oval } }), /must not be a training track/);
  assert.throws(() => parseGeneralization({ ...base, conditions: [{ name: 'a', tracks: ['moon'] }] }), /Unknown training track/);
  assert.throws(() => parseGeneralization({ ...base, seeds: undefined }), /missing "seeds"/);
  assert.equal(parseGeneralization(base).population, 100);
});

test('a run drives the champion once per training and test track; same seeds give the same CSV', () => {
  const rows = runAll(TINY);
  assert.equal(rows.length, 2 * (1 + 2) + 2 * (2 + 2)); // seeds × (training + test tracks) per condition
  const first = rows.filter((r) => r.condition === 'rotating' && r.seed === 1);
  assert.deepEqual(first.map((r) => `${r.split}:${r.track}`), ['train:oval', 'train:classic', 'test:triangle', 'test:square']);
  for (const r of rows) {
    assert.ok(r.laps >= 0 && r.laps <= 3);
    assert.ok(r.chosenGeneration >= 1 && r.chosenGeneration <= TINY.generations);
  }
  const csv = toCSV(rows, GENERALIZATION_COLUMNS, new Set());
  assert.equal(csv, toCSV(runAll(TINY), GENERALIZATION_COLUMNS, new Set()));
  assert.equal(csv.split('\n')[0], GENERALIZATION_COLUMNS.join(','));
  assert.deepEqual(fromCSV(csv, GENERALIZATION_STRINGS), rows);
});

test('summarizeGeneralization averages laps per run, then over runs', () => {
  const row = (seed, split, track, laps) => ({ condition: 'single', seed, split, track, laps, finished: laps === 3 ? 1 : 0 });
  const rows = [
    row(1, 'train', 'oval', 3), row(1, 'test', 'triangle', 3), row(1, 'test', 'square', 1),
    row(2, 'train', 'oval', 3), row(2, 'test', 'triangle', 0), row(2, 'test', 'square', 0),
  ];
  const [s] = summarizeGeneralization(rows, { ...TINY, conditions: [TINY.conditions[0]] });
  assert.equal(s.runs, 2);
  assert.equal(s.testLaps.mean, 1); // runs average 2 and 0
  assert.equal(s.testFinished.mean, 0.5);
  assert.equal(s.trainLaps.mean, 3);
  assert.deepEqual(s.perTrack.map((p) => [p.track, p.laps.mean, p.finished]), [['triangle', 1.5, 1], ['square', 0.5, 0]]);
});

test('chart has one bar per condition per group (test tracks + all) and a track outline per test track', () => {
  const summary = summarizeGeneralization(runAll(TINY), TINY);
  const thumbs = Object.fromEntries([...buildTestTracks(TINY)].map(([n, t]) => [n, t.center]));
  const svg = generalizationChartSVG(summary, { title: 'T', subtitle: 'S', yLabel: 'laps', allLabel: 'all', maxLaps: 3, thumbs });
  assert.equal(svg.match(/<path class="bar/g).length, 2 * 3);
  assert.equal(svg.match(/class="thumb"/g).length, 2);
  const md = generalizationMarkdown(TINY, summary);
  assert.match(md, /\| `triangle` \|/);
  assert.equal(md.split('\n').filter((l) => l.startsWith('| ') && l.includes(' ± ')).length, 2 + 2);
});

test('scoreOnTracks ranks a brain that drives every track above one that drives none', () => {
  const tracks = ['oval', 'technical'].map((n) => Track.preset(n));
  const good = scoreOnTracks(NeuralNetwork.fromJSON(PRETRAINED_BRAIN), tracks);
  assert.ok(good > 300, 'three laps on the worst track dominate');
  assert.equal(scoreOnTracks(new NeuralNetwork([8, 6, 2]), tracks), 0);
});

test('trainOnTracks rotates the track every generation and keeps a champion', () => {
  const tracks = ['oval', 'classic', 'technical'].map((n) => Track.preset(n));
  const seen = [];
  const { sim, champion } = trainOnTracks(tracks, { seed: 3, populationSize: 10 }, 4, {
    onGeneration: (_, index) => seen.push(index),
  });
  assert.deepEqual(seen, [0, 1, 2, 0]);
  assert.equal(sim.track, tracks[1]); // generation 5 would run on the second track
  assert.ok(champion.brain && champion.generation >= 1);
});

test('experiment files may define their own training tracks, which must be valid and not reuse names', () => {
  const corners = parseGeneralization(JSON.parse(readFileSync('experiments/generalization-corners.json', 'utf8')));
  for (const name of ['mild', 'sharp']) assert.ok(trainingTrack(corners, name).validate().ok, name);
  assert.equal(trainingTrack(corners, 'oval').n, Track.preset('oval').n);
  const base = { name: 'x', generations: 1, seeds: [1], conditions: [{ name: 'a', tracks: ['loop'] }], testTracks: {} };
  assert.throws(() => parseGeneralization(base), /Unknown training track "loop"/);
  const withLoop = { ...base, trainingTracks: { loop: SHIPPED.testTracks.square } };
  assert.equal(parseGeneralization(withLoop).conditions[0].tracks[0], 'loop');
  assert.throws(() => parseGeneralization({ ...withLoop, testTracks: { loop: SHIPPED.testTracks.square } }), /must not be a training track/);
  assert.throws(() => parseGeneralization({ ...base, trainingTracks: { oval: PRESETS.oval } }), /must not reuse a preset name/);
});

test('sharpestTurns: the oval only turns one way; the sharp training track matches the hardest test corners', () => {
  const oval = sharpestTurns(Track.preset('oval'));
  assert.ok(oval.right > 1 && oval.left > -0.01);
  const corners = parseGeneralization(JSON.parse(readFileSync('experiments/generalization-corners.json', 'utf8')));
  const tests = buildTestTracks(corners);
  const sharp = sharpestTurns(trainingTrack(corners, 'sharp'));
  const mild = sharpestTurns(trainingTrack(corners, 'mild'));
  const presets = ['oval', 'classic', 'technical'].map((n) => sharpestTurns(Track.preset(n)));
  // The sharp track's corners are about as hard as the triangle's right and the horseshoe's left ...
  assert.ok(Math.abs(sharp.right - sharpestTurns(tests.get('triangle')).right) < 0.05);
  assert.ok(sharp.left <= sharpestTurns(tests.get('horseshoe')).left);
  // ... while the mild track stays inside what the presets already contain.
  assert.ok(mild.right <= Math.max(...presets.map((p) => p.right)));
  assert.ok(mild.left >= Math.min(...presets.map((p) => p.left)));
});

test('a condition may change simulation settings, and unknown settings are rejected', () => {
  const def = parseGeneralization({
    ...TINY,
    seeds: [1],
    conditions: [{ name: 'few-rays', tracks: ['oval'], config: { rayCount: 3 } }],
  });
  const rows = runGeneralization(def, def.conditions[0], 1);
  assert.equal(rows.length, 1 + 2);
  assert.throws(() => parseGeneralization({ ...TINY, conditions: [{ name: 'x', tracks: ['oval'], config: { wings: 2 } }] }),
    /Unknown condition setting "wings"/);
  const shipped = parseGeneralization(JSON.parse(readFileSync('experiments/ray-count-generalization.json', 'utf8')));
  assert.deepEqual(shipped.conditions.map((c) => c.config.rayCount), [3, 5, 7, 9]);
});
