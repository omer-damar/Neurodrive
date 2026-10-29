// Player vs AI race (Phase 8): after a 3-2-1 countdown a keyboard-driven car and a brain-driven
// car race the same track side by side. A car that hits a wall is put back on the road after a
// short wait, so a crash costs time instead of ending the race. The race is over when the player
// finishes; whoever finished first wins. Also the read-only scene for renderers
// (`track`, `cars`, `leader` = the player, so the chase camera follows them).
import { LAPS, STEPS_PER_SECOND, RACE_COUNTDOWN_STEPS, RACE_RESPAWN_STEPS, RACE_LANE_OFFSET } from './config.js';
import { Car } from './car.js';

export const RACE_PHASES = Object.freeze({ COUNTDOWN: 'countdown', RACING: 'racing', FINISHED: 'finished' });

export class Race {
  /**
   * @param {import('./track.js').Track} track
   * @param {import('./neuralNetwork.js').NeuralNetwork} brain drives the AI car (its own sensors)
   * @param {{ laps?: number }} [options]
   */
  constructor(track, brain, { laps = LAPS } = {}) {
    this.track = track;
    this.brain = brain;
    this.laps = laps;
    // Neither car is killed for standing still or turning round; only walls stop them.
    const rules = { stuckSteps: Infinity, reverseTolerance: Infinity, laps };
    this.player = new Car(track, { ...rules, laneOffset: RACE_LANE_OFFSET });
    this.ai = new Car(track, { ...brain.sensor, ...rules, laneOffset: -RACE_LANE_OFFSET });
    this.cars = [this.player, this.ai];
    this.leader = this.player;
    // Per car: race time (steps since the start) at the end of each lap, crash count, respawn time.
    this.results = this.cars.map(() => ({ lapEnds: [], crashes: 0, respawnAt: -1 }));
    this.phase = RACE_PHASES.COUNTDOWN;
    this.countdown = RACE_COUNTDOWN_STEPS; // steps left before the start
    this.time = 0; // steps since the start
    this.winner = null; // 'player' | 'ai', set when the race is over
  }

  /** Whole seconds left in the countdown (3, 2, 1), or 0 once the race has started. */
  get countdownSeconds() {
    return Math.ceil(this.countdown / STEPS_PER_SECOND);
  }

  get playerResult() {
    return this.results[0];
  }

  get aiResult() {
    return this.results[1];
  }

  /**
   * Advances one fixed step. The player's controls are ignored during the countdown and after the end.
   * @param {number} throttle -1 (brake) .. 1 (gas)
   * @param {number} steer -1 (left) .. 1 (right)
   */
  step(throttle, steer) {
    if (this.phase === RACE_PHASES.FINISHED) return;
    if (this.phase === RACE_PHASES.COUNTDOWN) {
      if (--this.countdown <= 0) this.phase = RACE_PHASES.RACING;
      return;
    }
    this.time++;
    this.#drive(0, throttle, steer);
    const ai = this.ai;
    if (ai.alive && !ai.finished) {
      ai.sense();
      const out = this.brain.feedForward(ai.inputs);
      this.#drive(1, out[1], out[0]); // output 0 = steer, 1 = throttle
    } else {
      this.#drive(1, 0, 0); // only waits for a respawn
    }
    if (this.player.finished) this.#finish();
  }

  /** Lap times in steps, one per completed lap. */
  lapTimes(result) {
    return result.lapEnds.map((end, k) => end - (k === 0 ? 0 : result.lapEnds[k - 1]));
  }

  /** Total race time in steps, or null if the car has not finished. */
  totalTime(result) {
    return result.lapEnds.length >= this.laps ? result.lapEnds[this.laps - 1] : null;
  }

  #drive(index, throttle, steer) {
    const car = this.cars[index];
    const result = this.results[index];
    if (car.finished) return;
    if (!car.alive) {
      if (result.respawnAt < 0) {
        result.crashes++;
        result.respawnAt = this.time + RACE_RESPAWN_STEPS;
      } else if (this.time >= result.respawnAt) {
        car.respawn();
        result.respawnAt = -1;
      }
      return;
    }
    car.update(throttle, steer);
    while (result.lapEnds.length < car.lap) result.lapEnds.push(this.time);
  }

  #finish() {
    this.phase = RACE_PHASES.FINISHED;
    const ai = this.totalTime(this.aiResult);
    this.winner = ai !== null && ai < this.totalTime(this.playerResult) ? 'ai' : 'player';
  }
}
