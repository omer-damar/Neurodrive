// Generation loop: every car senses, thinks and moves each step; when the generation ends the
// population is ranked and bred. Also serves as the read-only scene for renderers
// (`track`, `cars`, `leader`).
import {
  POPULATION_SIZE,
  HIDDEN_NEURONS,
  OUTPUT_COUNT,
  RAY_COUNT,
  RAY_RANGE,
  RAY_SPREAD,
  MUTATION_RATE,
  MUTATION_STRENGTH,
  ELITE_COUNT,
  TOURNAMENT_SIZE,
  DEFAULT_SEED,
  MAX_STEPS,
  LAPS,
} from './config.js';
import { mulberry32 } from './math.js';
import { Car } from './car.js';
import { NeuralNetwork } from './neuralNetwork.js';
import { nextGeneration } from './genetics.js';

export const DEFAULT_SIM_CONFIG = Object.freeze({
  populationSize: POPULATION_SIZE,
  hiddenNeurons: HIDDEN_NEURONS,
  rayCount: RAY_COUNT,
  rayRange: RAY_RANGE,
  raySpread: RAY_SPREAD,
  mutationRate: MUTATION_RATE,
  mutationStrength: MUTATION_STRENGTH,
  eliteCount: ELITE_COUNT,
  tournamentSize: TOURNAMENT_SIZE,
  seed: DEFAULT_SEED,
  maxSteps: MAX_STEPS,
  laps: LAPS,
});

/** Laps completed as a fraction, plus a bonus for finishing early. */
export function fitnessOf(car, maxSteps) {
  const laps = Math.min(car.maxProgress, car.laps * car.track.n) / car.track.n;
  return laps + (car.finished ? 1 - car.finishStep / maxSteps : 0);
}

/**
 * Simulation settings that match a brain's shape and sensors, so a population can be seeded from it.
 * Only networks with one hidden layer and OUTPUT_COUNT outputs fit the simulation.
 * @returns {{ hiddenNeurons: number, rayCount: number, rayRange: number, raySpread: number } | null}
 */
export function configForBrain(brain) {
  const { sizes, sensor } = brain;
  if (sizes.length !== 3 || sizes[2] !== OUTPUT_COUNT) return null;
  return { hiddenNeurons: sizes[1], rayCount: sensor.rayCount, rayRange: sensor.rayRange, raySpread: sensor.raySpread };
}

/**
 * Drives one car with a fixed brain (no learning) until it finishes, dies or runs out of time.
 * Used to check how well a saved or pretrained brain generalizes to a track.
 */
export function driveBrain(brain, track, { maxSteps = MAX_STEPS, laps = LAPS } = {}) {
  const car = new Car(track, { ...brain.sensor, laps });
  let steps = 0;
  while (car.alive && !car.finished && steps < maxSteps) {
    car.sense();
    const out = brain.feedForward(car.inputs);
    car.update(out[1], out[0]); // output 0 = steer, 1 = throttle
    steps++;
  }
  return { laps: car.lap, finished: car.finished, steps, deathCause: car.deathCause, lapSteps: car.lapSteps.slice() };
}

/**
 * How well one brain drives a set of tracks on its own: laps on its worst track first, then the
 * total laps plus finish bonuses. Ranks brains for "drives every track" rather than for one track.
 */
export function scoreOnTracks(brain, tracks, { maxSteps = MAX_STEPS } = {}) {
  let total = 0;
  let worst = Infinity;
  for (const track of tracks) {
    const result = driveBrain(brain, track, { maxSteps });
    total += result.laps + (result.finished ? 1 - result.steps / maxSteps : 0);
    worst = Math.min(worst, result.laps);
  }
  return worst * 100 + total;
}

export class Simulation {
  /**
   * @param {import('./track.js').Track} track
   * @param {Partial<typeof DEFAULT_SIM_CONFIG>} [config]
   */
  constructor(track, config = {}) {
    this.config = { ...DEFAULT_SIM_CONFIG, ...config };
    const c = this.config;
    this.rng = mulberry32(c.seed);
    this.track = track;
    this.sizes = [c.rayCount + 1, c.hiddenNeurons, OUTPUT_COUNT];
    this.sensor = { rayCount: c.rayCount, rayRange: c.rayRange, raySpread: c.raySpread };
    this.brains = Array.from({ length: c.populationSize }, () => new NeuralNetwork(this.sizes, this.rng, this.sensor));
    this.cars = this.brains.map(() => new Car(track, { ...this.sensor, laps: c.laps }));
    this.fitness = new Float64Array(c.populationSize);
    this.parents = this.brains.map(() => []);
    this.generation = 1;
    this.generationStep = 0;
    this.history = [];
    this.bestBrain = null; // all-time champion (clone)
    this.bestFitness = -Infinity;
    this.leader = this.cars[0];
    this.onGeneration = null; // (stats) => void
    this.onTrackChange = null; // (track) => void
  }

  /** Advances every running car by one fixed step; ends the generation when nobody is left. */
  step() {
    let running = 0;
    let leader = null;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (!car.alive || car.finished) continue;
      car.sense();
      const out = this.brains[i].feedForward(car.inputs);
      car.update(out[1], out[0]); // output 0 = steer, 1 = throttle
      if (car.alive && !car.finished) {
        running++;
        if (!leader || car.maxProgress > leader.maxProgress) leader = car;
      }
    }
    this.generationStep++;
    this.leader = leader ?? this.#furthestCar();
    if (running === 0 || this.generationStep >= this.config.maxSteps) this.endGeneration();
  }

  /** Scores the generation, records stats, breeds the next one and restarts the cars. */
  endGeneration() {
    const c = this.config;
    let best = -Infinity;
    let bestIndex = 0;
    let sum = 0;
    let finishedCount = 0;
    let bestLapSteps = Infinity;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const f = fitnessOf(car, c.maxSteps);
      this.fitness[i] = f;
      sum += f;
      if (f > best) {
        best = f;
        bestIndex = i;
      }
      if (car.finished) finishedCount++;
      for (let lap = 0; lap < car.lapSteps.length; lap++) {
        const lapTime = car.lapSteps[lap] - (lap === 0 ? 0 : car.lapSteps[lap - 1]);
        if (lapTime < bestLapSteps) bestLapSteps = lapTime;
      }
    }
    const stats = {
      generation: this.generation,
      best,
      avg: sum / this.cars.length,
      finishedCount,
      bestLapSteps: Number.isFinite(bestLapSteps) ? bestLapSteps : null,
    };
    this.history.push(stats);
    if (best > this.bestFitness) {
      this.bestFitness = best;
      this.bestBrain = this.brains[bestIndex].clone();
    }

    const result = nextGeneration(this.brains, this.fitness, this.rng, c);
    this.brains = result.brains;
    this.parents = result.parents;
    this.generation++;
    this.#restartCars();
    if (this.onGeneration) this.onGeneration(stats);
    return stats;
  }

  /** Switches track but keeps the brains (generalization test); the current run restarts. */
  setTrack(track) {
    this.track = track;
    for (const car of this.cars) car.reset(track);
    this.generationStep = 0;
    this.leader = this.cars[0];
    if (this.onTrackChange) this.onTrackChange(track);
  }

  /** Restarts the population from one brain: the original plus mutated copies. */
  seedFrom(brain) {
    const c = this.config;
    this.brains = this.brains.map((_, i) =>
      i === 0 ? brain.clone() : brain.clone().mutate(c.mutationRate, c.mutationStrength, this.rng));
    this.#restartCars();
  }

  /** Runs whole generations headlessly; returns their stats. */
  runGenerations(count) {
    const target = this.generation + count;
    while (this.generation < target) this.step();
    return this.history.slice(-count);
  }

  #restartCars() {
    for (const car of this.cars) car.reset(this.track);
    this.generationStep = 0;
    this.leader = this.cars[0];
  }

  #furthestCar() {
    let best = this.cars[0];
    for (const car of this.cars) if (car.maxProgress > best.maxProgress) best = car;
    return best;
  }
}
