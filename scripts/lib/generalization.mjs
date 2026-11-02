// Experiment 2 (README, Experiments): do brains drive tracks they never saw? Each condition trains on
// its own tracks (presets or tracks defined in the experiment file; one, or several in rotation)
// with the same number of generations; the
// champion is chosen on those training tracks only, then drives every track (training and held-out
// test tracks) once without learning. Pure: no file system, so tests call everything directly.
import { driveBrain } from '../../src/core/simulation.js';
import { Track, PRESETS } from '../../src/core/track.js';
import { trainOnTracks } from './training.mjs';
import { meanSd, groupBy, VARIABLES } from './experiment.mjs';

export const GENERALIZATION_COLUMNS = Object.freeze([
  'experiment',
  'condition',
  'seed',
  'chosenGeneration',
  'split',
  'track',
  'laps',
  'finished',
  'steps',
  'bestLapSteps',
]);
export const GENERALIZATION_STRINGS = new Set(['experiment', 'condition', 'split', 'track']);

/** CSV columns of a definition: noise experiments add the test noise level after the track. */
export function generalizationColumns(def) {
  if (!def.testNoise) return GENERALIZATION_COLUMNS;
  const columns = [...GENERALIZATION_COLUMNS];
  columns.splice(columns.indexOf('track') + 1, 0, 'testNoise');
  return columns;
}
export const CORNER_WINDOW = 24; // centre points each side for sharpestTurns()

/**
 * Validates a generalization definition (experiments/*.json with "type": "generalization").
 * Training tracks are presets or names from `trainingTracks` (control points in the file). A
 * condition may also change simulation settings (`config`, e.g. { rayCount: 3 }); the champion
 * keeps its own sensors when it drives the test tracks.
 * @returns {{ type: string, name: string, title: string, generations: number, population: number,
 *             seeds: number[], conditions: { name: string, label: string, tracks: string[] }[],
 *             trainingTracks: Record<string, number[][]>, testTracks: Record<string, number[][]> }}
 */
export function parseGeneralization(json) {
  const def = { population: 100, trainingTracks: {}, ...json };
  for (const key of ['name', 'generations', 'seeds', 'conditions', 'testTracks']) {
    if (def[key] === undefined) throw new Error(`Experiment definition is missing "${key}"`);
  }
  def.title ??= def.name;
  for (const name of Object.keys(def.trainingTracks)) {
    if (PRESETS[name]) throw new Error(`Training track "${name}" must not reuse a preset name`);
  }
  for (const c of def.conditions) {
    if (!c.name || !Array.isArray(c.tracks) || c.tracks.length === 0) throw new Error('A condition needs a name and tracks');
    for (const t of c.tracks) if (!PRESETS[t] && !def.trainingTracks[t]) throw new Error(`Unknown training track "${t}"`);
    c.config ??= {};
    for (const key of Object.keys(c.config)) if (!VARIABLES[key]) throw new Error(`Unknown condition setting "${key}"`);
    c.label ??= c.name;
  }
  for (const name of Object.keys(def.testTracks)) {
    if (PRESETS[name] || def.trainingTracks[name]) throw new Error(`Test track "${name}" must not be a training track`);
  }
  def.testNoise ??= null; // optional list of sensor noise levels the champions are tested at
  if (def.testNoise && !def.testNoise.every((n) => n >= 0 && n < 1)) throw new Error('testNoise levels must be in [0, 1)');
  return def;
}

/** The held-out tracks as Track objects; throws when one fails validate(). */
export function buildTestTracks(def) {
  return buildTracks(def.testTracks, 'Test');
}

/** Training track by name: a preset, or one defined in the experiment file. */
export function trainingTrack(def, name) {
  return PRESETS[name] ? Track.preset(name) : buildTracks({ [name]: def.trainingTracks[name] }, 'Training').get(name);
}

function buildTracks(pointsByName, kind) {
  const tracks = new Map();
  for (const [name, points] of Object.entries(pointsByName)) {
    const track = new Track(points);
    const check = track.validate();
    if (!check.ok) throw new Error(`${kind} track "${name}" is invalid: ${check.error}`);
    tracks.set(name, track);
  }
  return tracks;
}

/**
 * The sharpest right and left turn of a track: the heading change across a window of ± `window`
 * centre points (± 240 units at the default 10-unit spacing), in radians; right is positive in
 * screen space. Describes how hard a track's hardest corners are.
 */
export function sharpestTurns(track, window = CORNER_WINDOW) {
  const n = track.n;
  const c = track.center;
  let right = 0;
  let left = 0;
  for (let i = 0; i < n; i++) {
    const a = (i - window + n) % n;
    const b = (i + window) % n;
    const before = Math.atan2(c[i * 2 + 1] - c[a * 2 + 1], c[i * 2] - c[a * 2]);
    const after = Math.atan2(c[b * 2 + 1] - c[i * 2 + 1], c[b * 2] - c[i * 2]);
    const turn = Math.atan2(Math.sin(after - before), Math.cos(after - before));
    if (turn > right) right = turn;
    if (turn < left) left = turn;
  }
  return { right, left };
}

/** Trains one (condition, seed) run and drives its champion on every track: one row per track. */
export function runGeneralization(def, condition, seed, testTracks = buildTestTracks(def)) {
  const training = condition.tracks.map((name) => trainingTrack(def, name));
  const config = { seed, populationSize: def.population, ...condition.config };
  const { champion } = trainOnTracks(training, config, def.generations);
  const levels = def.testNoise ?? [0];
  let drives = 0; // gives every noisy drive its own, reproducible noise seed
  const drive = (split, name, track, testNoise) => {
    const noiseSeed = seed * 1000 + drives++;
    const result = driveBrain(champion.brain, track, { sensorNoise: testNoise, noiseSeed });
    const laps = result.lapSteps.map((end, k) => end - (k === 0 ? 0 : result.lapSteps[k - 1]));
    return {
      experiment: def.name,
      condition: condition.name,
      seed,
      chosenGeneration: champion.generation,
      split,
      track: name,
      ...(def.testNoise ? { testNoise } : {}),
      laps: result.laps,
      finished: result.finished ? 1 : 0,
      steps: result.steps,
      bestLapSteps: laps.length ? Math.min(...laps) : null,
    };
  };
  return levels.flatMap((level) => [
    ...condition.tracks.map((name, i) => drive('train', name, training[i], level)),
    ...[...testTracks].map(([name, track]) => drive('test', name, track, level)),
  ]);
}

/**
 * Per condition: per run, the mean laps and the number of finished tracks over the test tracks
 * (then mean ± sd over runs), and per test track the mean ± sd laps and how many runs finished it.
 */
export function summarizeGeneralization(rows, def) {
  const byCondition = groupBy(rows, (r) => r.condition);
  return def.conditions.map((condition) => {
    const conditionRows = byCondition.get(condition.name) ?? [];
    const runs = [...groupBy(conditionRows, (r) => r.seed).values()];
    const test = (run) => run.filter((r) => r.split === 'test');
    const train = (run) => run.filter((r) => r.split === 'train');
    const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
    const testNames = Object.keys(def.testTracks);
    return {
      condition: condition.name,
      label: condition.label,
      runs: runs.length,
      testLaps: meanSd(runs.map((run) => mean(test(run).map((r) => r.laps)))),
      testFinished: meanSd(runs.map((run) => test(run).filter((r) => r.finished).length)),
      trainLaps: meanSd(runs.map((run) => mean(train(run).map((r) => r.laps)))),
      perTrack: testNames.map((track) => {
        const trackRows = conditionRows.filter((r) => r.split === 'test' && r.track === track);
        return {
          track,
          laps: meanSd(trackRows.map((r) => r.laps)),
          finished: trackRows.filter((r) => r.finished).length,
          runs: trackRows.length,
        };
      }),
    };
  });
}

/**
 * Noise experiments: per condition and test noise level, the per-run mean laps on the training
 * tracks and on the unseen tracks (mean ± sd over runs), and how many drives finished.
 */
export function summarizeNoise(rows, def) {
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  return def.conditions.map((condition) => {
    const conditionRows = rows.filter((r) => r.condition === condition.name);
    const runs = [...groupBy(conditionRows, (r) => r.seed).values()];
    return {
      condition: condition.name,
      label: condition.label,
      runs: runs.length,
      levels: def.testNoise.map((level) => {
        const at = (run, split) => run.filter((r) => r.testNoise === level && r.split === split);
        const split = (name) => ({
          laps: meanSd(runs.map((run) => mean(at(run, name).map((r) => r.laps)))),
          finished: runs.reduce((n, run) => n + at(run, name).filter((r) => r.finished).length, 0),
          drives: runs.reduce((n, run) => n + at(run, name).length, 0),
        });
        return { level, train: split('train'), test: split('test') };
      }),
    };
  });
}
