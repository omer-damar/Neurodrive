// Headless training on one track or on several in rotation, keeping the brain that drives a set of
// selection tracks best. Shared by scripts/train.mjs and the generalization experiment.
import { Simulation, scoreOnTracks } from '../../src/core/simulation.js';
import { ELITE_COUNT } from '../../src/core/config.js';

/**
 * Trains `generations` generations. With several tracks the track changes every generation (the
 * brains are kept). After each generation its elites are scored on `selectionTracks` and the best
 * one seen so far is the champion: not the highest single-track fitness, which with rotating
 * tracks is usually an easy-track specialist.
 * @param {import('../../src/core/track.js').Track[]} tracks
 * @param {object} config Simulation config (seed, population, mutation rate, ...)
 * @param {{ selectionTracks?: object[], onGeneration?: (stats: object, trackIndex: number) => void }} [options]
 * @returns {{ sim: Simulation, champion: { brain: object, score: number, generation: number } }}
 */
export function trainOnTracks(tracks, config, generations, { selectionTracks = tracks, onGeneration = null } = {}) {
  const sim = new Simulation(tracks[0], config);
  let current = 0; // index of the track the running generation uses
  let champion = { brain: null, score: -Infinity, generation: 0 };
  sim.onGeneration = (stats) => {
    if (onGeneration) onGeneration(stats, current);
    // The next generation's first brains are this generation's elites, unchanged.
    for (let e = 0; e < ELITE_COUNT; e++) {
      const score = scoreOnTracks(sim.brains[e], selectionTracks);
      if (score > champion.score) champion = { brain: sim.brains[e].clone(), score, generation: stats.generation };
    }
    if (tracks.length > 1) {
      current = stats.generation % tracks.length;
      sim.setTrack(tracks[current]);
    }
  };
  sim.runGenerations(generations);
  return { sim, champion };
}
