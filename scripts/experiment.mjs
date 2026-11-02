// Runs every run of an experiment definition, writes the CSV, then plots it.
// npm run experiment -- experiments/mutation-rate.json     (sweep: variable value × seed)
// npm run experiment -- experiments/generalization.json    ("type": "generalization": condition × seed)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

import { parseDefinition, runCondition, toCSV } from './lib/experiment.mjs';
import {
  parseGeneralization,
  buildTestTracks,
  runGeneralization,
  generalizationColumns,
} from './lib/generalization.mjs';
import { plot, plotGeneralization, resultPaths } from './plot.mjs';

const defPath = process.argv[2];
if (!defPath) {
  console.error('Usage: npm run experiment -- experiments/<name>.json');
  process.exit(1);
}
const json = JSON.parse(readFileSync(defPath, 'utf8'));
const started = Date.now();

// Runs `jobs` in order with a progress line each; returns all their rows.
function runAll(jobs, describe) {
  const rows = [];
  jobs.forEach((job, k) => {
    const t0 = Date.now();
    const jobRows = job.run();
    rows.push(...jobRows);
    console.log(`[${String(k + 1).padStart(String(jobs.length).length)}/${jobs.length}] ${job.label} ${describe(jobRows)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  });
  return rows;
}

let def;
let paths;
mkdirSync('experiments/results', { recursive: true });
if (json.type === 'generalization') {
  def = parseGeneralization(json);
  const testTracks = buildTestTracks(def);
  const jobs = def.conditions.flatMap((condition) =>
    def.seeds.map((seed) => ({ label: `${condition.name} seed=${seed}`, run: () => runGeneralization(def, condition, seed, testTracks) })));
  console.log(`${def.name}: ${def.conditions.map((c) => c.name).join(' vs ')} × ${def.seeds.length} seeds, tested on ${testTracks.size} unseen tracks = ${jobs.length} runs`);
  const rows = runAll(jobs, (r) => `test laps ${r.filter((x) => x.split === 'test' && !x.testNoise).map((x) => x.laps).join(' ')}`);
  paths = resultPaths(def);
  writeFileSync(paths.csv, toCSV(rows, generalizationColumns(def), new Set()));
  plotGeneralization(def, rows);
} else {
  def = parseDefinition(json);
  const jobs = def.values.flatMap((value) =>
    def.seeds.map((seed) => ({ label: `${def.variable}=${value} seed=${seed}`, run: () => runCondition(def, value, seed) })));
  console.log(`${def.name}: ${def.variable} ∈ {${def.values.join(', ')}} × ${def.seeds.length} seeds on ${def.track} = ${jobs.length} runs`);
  const rows = runAll(jobs, (r) => `best=${r[r.length - 1].best.toFixed(3)}`);
  paths = resultPaths(def);
  writeFileSync(paths.csv, toCSV(rows));
  plot(def, rows);
}
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s → ${paths.csv}, ${paths.svg}, ${paths.md}`);
