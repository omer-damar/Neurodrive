// Pure experiment helpers: run one condition, turn rows into CSV and back, summarize per condition.
// No file system here so tests can call everything directly.
import { Simulation } from '../../src/core/simulation.js';
import { Track } from '../../src/core/track.js';

export const CSV_COLUMNS = Object.freeze([
  'experiment',
  'variable',
  'value',
  'seed',
  'generation',
  'best',
  'avg',
  'finished',
  'bestLapSteps',
]);

// Simulation config keys an experiment may vary.
export const VARIABLES = Object.freeze({
  mutationRate: 'mutationRate',
  mutationStrength: 'mutationStrength',
  populationSize: 'populationSize',
  hiddenNeurons: 'hiddenNeurons',
  rayCount: 'rayCount',
  sensorNoise: 'sensorNoise',
  raySpread: 'raySpread', // total fan width in radians
});

/**
 * Validates an experiment definition (experiments/*.json) and fills defaults.
 * @returns {{ name: string, title: string, track: string, generations: number,
 *             population: number, seeds: number[], variable: string, values: number[] }}
 */
export function parseDefinition(json) {
  const def = { population: 100, ...json };
  for (const key of ['name', 'track', 'generations', 'seeds', 'variable', 'values']) {
    if (def[key] === undefined) throw new Error(`Experiment definition is missing "${key}"`);
  }
  if (!VARIABLES[def.variable]) throw new Error(`Unknown experiment variable "${def.variable}"`);
  def.title ??= def.name;
  return def;
}

/** Trains one (value, seed) condition headlessly and returns one row per generation. */
export function runCondition(def, value, seed) {
  const config = { seed, populationSize: def.population, [def.variable]: value };
  const sim = new Simulation(Track.preset(def.track), config);
  return sim.runGenerations(def.generations).map((s) => ({
    experiment: def.name,
    variable: def.variable,
    value,
    seed,
    generation: s.generation,
    best: s.best,
    avg: s.avg,
    finished: s.finishedCount,
    bestLapSteps: s.bestLapSteps,
  }));
}

const FIXED_COLUMNS = new Set(['best', 'avg']); // floats written with 6 decimals
const STRING_COLUMNS = new Set(['experiment', 'variable']);

/**
 * Fixed column order and number formatting, so identical runs give byte-identical files.
 * @param {readonly string[]} [columns] column order (another experiment type passes its own)
 * @param {Set<string>} [fixed] float columns written with 6 decimals
 */
export function toCSV(rows, columns = CSV_COLUMNS, fixed = FIXED_COLUMNS) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => formatCell(row[col], fixed.has(col))).join(','));
  }
  return lines.join('\n') + '\n';
}

/** @param {Set<string>} [strings] columns kept as text; every other cell is a number (empty = null) */
export function fromCSV(text, strings = STRING_COLUMNS) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const row = {};
    columns.forEach((col, i) => {
      const cell = cells[i];
      row[col] = cell === '' ? null : strings.has(col) ? cell : Number(cell);
    });
    return row;
  });
}

function formatCell(value, fixed) {
  if (value === null || value === undefined) return '';
  return fixed ? value.toFixed(6) : String(value);
}

/**
 * Per condition (variable value): per-generation mean ± sd of best fitness, and per-run outcomes
 * summarized as mean ± sd.
 * - firstLapGeneration: first generation whose best car completed a lap (runs that never did are
 *   counted in `neverLapped` and left out of the mean).
 * - bestLapSteps: fastest lap seen in the whole run.
 */
export function summarize(rows) {
  const byValue = groupBy(rows, (r) => r.value);
  return [...byValue.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, valueRows]) => {
      const runs = [...groupBy(valueRows, (r) => r.seed).values()];
      const generations = [...new Set(valueRows.map((r) => r.generation))].sort((a, b) => a - b);
      const curve = generations.map((g) => {
        const bests = valueRows.filter((r) => r.generation === g).map((r) => r.best);
        return { generation: g, ...meanSd(bests) };
      });
      const firstLaps = [];
      const bestLaps = [];
      let neverLapped = 0;
      for (const run of runs) {
        const first = run.find((r) => r.best >= 1);
        if (first) firstLaps.push(first.generation);
        else neverLapped++;
        const laps = run.map((r) => r.bestLapSteps).filter((v) => v !== null);
        if (laps.length) bestLaps.push(Math.min(...laps));
      }
      return {
        value,
        runs: runs.length,
        curve,
        firstLapGeneration: meanSd(firstLaps),
        neverLapped,
        bestLapSteps: meanSd(bestLaps),
        finalBest: meanSd(runs.map((run) => run[run.length - 1].best)),
      };
    });
}

/** Mean and sample standard deviation; n = 0 gives nulls. */
export function meanSd(values) {
  const n = values.length;
  if (n === 0) return { mean: null, sd: null, n };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
  return { mean, sd, n };
}

export function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}
