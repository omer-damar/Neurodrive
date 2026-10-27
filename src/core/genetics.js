// One generation step of the genetic algorithm: rank, keep elites, breed the rest.
import { ELITE_COUNT, TOURNAMENT_SIZE, MUTATION_RATE, MUTATION_STRENGTH } from './config.js';
import { NeuralNetwork } from './neuralNetwork.js';

/**
 * Builds the next population. Population size is preserved.
 * @param {NeuralNetwork[]} brains current population
 * @param {ArrayLike<number>} fitness fitness per brain (same order)
 * @param {() => number} rng
 * @param {{ eliteCount?: number, tournamentSize?: number,
 *           mutationRate?: number, mutationStrength?: number }} [options]
 * @returns {{ brains: NeuralNetwork[], parents: number[][], ranking: number[] }}
 *   `parents[i]` lists the indices (in the old population) child i came from — one index for an
 *   elite copy, two for a crossover child. Kept for lineage colours later. `ranking` is the old
 *   population's indices from best to worst.
 */
export function nextGeneration(brains, fitness, rng, options = {}) {
  const eliteCount = Math.min(options.eliteCount ?? ELITE_COUNT, brains.length);
  const tournamentSize = options.tournamentSize ?? TOURNAMENT_SIZE;
  const mutationRate = options.mutationRate ?? MUTATION_RATE;
  const mutationStrength = options.mutationStrength ?? MUTATION_STRENGTH;

  // Stable sort keeps ties in index order, so runs are reproducible.
  const ranking = brains.map((_, i) => i).sort((a, b) => fitness[b] - fitness[a]);

  const next = [];
  const parents = [];
  for (let e = 0; e < eliteCount; e++) {
    next.push(brains[ranking[e]].clone());
    parents.push([ranking[e]]);
  }
  while (next.length < brains.length) {
    const a = tournament(fitness, tournamentSize, rng);
    const b = tournament(fitness, tournamentSize, rng);
    const child = NeuralNetwork.crossover(brains[a], brains[b], rng);
    child.mutate(mutationRate, mutationStrength, rng);
    next.push(child);
    parents.push([a, b]);
  }
  return { brains: next, parents, ranking };
}

/** Picks `size` random individuals (with replacement) and returns the fittest one's index. */
export function tournament(fitness, size, rng) {
  let best = Math.floor(rng() * fitness.length);
  for (let k = 1; k < size; k++) {
    const i = Math.floor(rng() * fitness.length);
    if (fitness[i] > fitness[best]) best = i;
  }
  return best;
}
