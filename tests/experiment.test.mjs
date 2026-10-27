import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CSV_COLUMNS,
  parseDefinition,
  runCondition,
  toCSV,
  fromCSV,
  summarize,
  meanSd,
} from '../scripts/lib/experiment.mjs';
import { fitnessChartSVG, summaryMarkdown } from '../scripts/lib/svg.mjs';

const SMALL = parseDefinition({
  name: 'tiny',
  track: 'oval',
  generations: 3,
  population: 10,
  seeds: [1, 2],
  variable: 'mutationRate',
  values: [0.05, 0.3],
});

function runAll(def) {
  return def.values.flatMap((v) => def.seeds.flatMap((s) => runCondition(def, v, s)));
}

test('the same definition and seeds produce a byte-identical CSV', () => {
  assert.equal(toCSV(runAll(SMALL)), toCSV(runAll(SMALL)));
});

test('CSV has the fixed column order and one row per generation per run', () => {
  const csv = toCSV(runAll(SMALL));
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'experiment,variable,value,seed,generation,best,avg,finished,bestLapSteps');
  assert.deepEqual(lines[0].split(','), [...CSV_COLUMNS]);
  assert.equal(lines.length - 1, SMALL.values.length * SMALL.seeds.length * SMALL.generations);
  assert.match(lines[1], /^tiny,mutationRate,0\.05,1,1,/);
});

test('fromCSV reads back what toCSV wrote', () => {
  const rows = runAll(SMALL);
  const back = fromCSV(toCSV(rows));
  assert.equal(back.length, rows.length);
  assert.equal(back[0].experiment, 'tiny');
  assert.equal(back[0].value, 0.05);
  assert.ok(Math.abs(back[0].best - rows[0].best) < 1e-6);
  assert.equal(back.find((r) => r.bestLapSteps === null) !== undefined, rows.some((r) => r.bestLapSteps === null));
});

test('different values of the variable change the outcome', () => {
  // Generation 1 is identical (same seed, mutation not applied yet); breeding differs after that.
  const a = runCondition(SMALL, 0.05, 1);
  const b = runCondition(SMALL, 0.3, 1);
  assert.equal(a[0].avg, b[0].avg);
  assert.notDeepEqual(a.slice(1).map((r) => r.avg), b.slice(1).map((r) => r.avg));
});

test('summarize computes per-condition curves and run outcomes', () => {
  const rows = [
    // value 0.1, seed 1: laps from generation 2, best lap 500
    { value: 0.1, seed: 1, generation: 1, best: 0.5, bestLapSteps: null },
    { value: 0.1, seed: 1, generation: 2, best: 1.2, bestLapSteps: 600 },
    { value: 0.1, seed: 1, generation: 3, best: 3.4, bestLapSteps: 500 },
    // value 0.1, seed 2: never laps
    { value: 0.1, seed: 2, generation: 1, best: 0.3, bestLapSteps: null },
    { value: 0.1, seed: 2, generation: 2, best: 0.4, bestLapSteps: null },
    { value: 0.1, seed: 2, generation: 3, best: 0.6, bestLapSteps: null },
  ];
  const [s] = summarize(rows);
  assert.equal(s.value, 0.1);
  assert.equal(s.runs, 2);
  assert.deepEqual(s.firstLapGeneration, { mean: 2, sd: 0, n: 1 });
  assert.equal(s.neverLapped, 1);
  assert.deepEqual(s.bestLapSteps, { mean: 500, sd: 0, n: 1 });
  assert.equal(s.curve.length, 3);
  assert.ok(Math.abs(s.curve[2].mean - 2) < 1e-12);
  assert.ok(Math.abs(s.finalBest.mean - 2) < 1e-12);
});

test('meanSd uses the sample standard deviation', () => {
  assert.deepEqual(meanSd([]), { mean: null, sd: null, n: 0 });
  assert.deepEqual(meanSd([4]), { mean: 4, sd: 0, n: 1 });
  const { mean, sd } = meanSd([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(mean, 5);
  assert.ok(Math.abs(sd - 2.138089935) < 1e-6);
});

test('parseDefinition rejects missing keys and unknown variables', () => {
  assert.throws(() => parseDefinition({ name: 'x' }), /missing/);
  assert.throws(() => parseDefinition({ ...SMALL, variable: 'speed' }), /Unknown/);
});

test('the shipped mutation-rate definition is valid', () => {
  const def = parseDefinition(JSON.parse(readFileSync(new URL('../experiments/mutation-rate.json', import.meta.url), 'utf8')));
  assert.equal(def.variable, 'mutationRate');
  assert.equal(def.seeds.length, 10);
});

test('chart has one line per condition plus labels, and the report has one row per condition', () => {
  const summary = summarize(runAll(SMALL));
  const svg = fitnessChartSVG(summary, {
    title: 'T',
    subtitle: 'S',
    valueLabel: (v) => `rate ${v}`,
    xLabel: 'Generation',
    yLabel: 'Best fitness',
  });
  assert.equal((svg.match(/<polyline/g) ?? []).length, 2);
  assert.ok(svg.includes('rate 0.05') && svg.includes('rate 0.3'));
  assert.ok(svg.startsWith('<svg') && svg.trim().endsWith('</svg>'));
  const md = summaryMarkdown(SMALL, summary, (v) => `rate ${v}`);
  assert.equal(md.split('\n').filter((l) => l.startsWith('| rate')).length, 2);
});
