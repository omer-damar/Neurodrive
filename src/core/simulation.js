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
