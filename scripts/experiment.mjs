// Runs every (value × seed) condition of an experiment definition, writes the CSV, then plots it.
// npm run experiment -- experiments/mutation-rate.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

import { parseDefinition, runCondition, toCSV } from './lib/experiment.mjs';
import { plot, resultPaths } from './plot.mjs';

const defPath = process.argv[2];
if (!defPath) {
  console.error('Usage: npm run experiment -- experiments/<name>.json');
  process.exit(1);
}
const def = parseDefinition(JSON.parse(readFileSync(defPath, 'utf8')));
const total = def.values.length * def.seeds.length;
console.log(`${def.name}: ${def.variable} ∈ {${def.values.join(', ')}} × ${def.seeds.length} seeds on ${def.track} = ${total} runs`);

const started = Date.now();
const rows = [];
let done = 0;
for (const value of def.values) {
  for (const seed of def.seeds) {
    const t0 = Date.now();
    const runRows = runCondition(def, value, seed);
    rows.push(...runRows);
    done++;
    const last = runRows[runRows.length - 1];
    console.log(
      `[${String(done).padStart(String(total).length)}/${total}] ${def.variable}=${value} seed=${seed}` +
        ` best=${last.best.toFixed(3)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  }
}

const paths = resultPaths(def);
mkdirSync('experiments/results', { recursive: true });
writeFileSync(paths.csv, toCSV(rows));
plot(def, rows);
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s → ${paths.csv}, ${paths.svg}, ${paths.md}`);
