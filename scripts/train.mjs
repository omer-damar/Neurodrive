// Headless training CLI.
// npm run train -- --track classic --generations 80 --population 100 --seed 42 --mutation-rate 0.1 --out trained/classic.json
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { Simulation, DEFAULT_SIM_CONFIG } from '../src/core/simulation.js';
import { Track, PRESETS } from '../src/core/track.js';
import { DEFAULT_TRACK, STEPS_PER_SECOND } from '../src/core/config.js';

const { values } = parseArgs({
  options: {
    track: { type: 'string', default: DEFAULT_TRACK },
    generations: { type: 'string', default: '50' },
    population: { type: 'string', default: String(DEFAULT_SIM_CONFIG.populationSize) },
    seed: { type: 'string', default: String(DEFAULT_SIM_CONFIG.seed) },
    'mutation-rate': { type: 'string', default: String(DEFAULT_SIM_CONFIG.mutationRate) },
    out: { type: 'string' },
  },
});

if (!PRESETS[values.track]) {
  console.error(`Unknown track "${values.track}". Choose one of: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}
const generations = Number(values.generations);
const config = {
  populationSize: Number(values.population),
  seed: Number(values.seed),
  mutationRate: Number(values['mutation-rate']),
};
const out = values.out ?? `trained/${values.track}-seed${config.seed}.json`;

const sim = new Simulation(Track.preset(values.track), config);
const started = Date.now();
console.log(`track=${values.track} population=${config.populationSize} seed=${config.seed} mutationRate=${config.mutationRate}`);
console.log('gen     best      avg  finished  bestLap');
sim.onGeneration = (s) => {
  const lap = s.bestLapSteps === null ? '-' : `${(s.bestLapSteps / STEPS_PER_SECOND).toFixed(2)}s`;
  console.log(
    `${String(s.generation).padStart(3)}  ${s.best.toFixed(3).padStart(7)}  ${s.avg.toFixed(3).padStart(7)}` +
      `  ${String(s.finishedCount).padStart(8)}  ${lap.padStart(7)}`,
  );
};
sim.runGenerations(generations);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(sim.bestBrain.toJSON(), null, 2) + '\n');
console.log(`best fitness ${sim.bestFitness.toFixed(3)} · ${((Date.now() - started) / 1000).toFixed(1)}s · saved ${out}`);
