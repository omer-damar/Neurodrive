// Converts variable frame times into a whole number of fixed simulation steps.
// Pure (no DOM) so it can be tested in Node.
import { STEPS_PER_SECOND, MAX_FRAME_DT_MS, MAX_STEPS_PER_FRAME } from '../core/config.js';

export class FixedStepper {
  constructor({
    stepMs = 1000 / STEPS_PER_SECOND,
    maxFrameMs = MAX_FRAME_DT_MS,
    maxStepsPerFrame = MAX_STEPS_PER_FRAME,
  } = {}) {
    this.stepMs = stepMs;
    this.maxFrameMs = maxFrameMs;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.accumulator = 0;
  }

  /**
   * @param {number} frameMs real time since the previous frame
   * @param {number} speed simulation speed multiplier (1 = real time)
   * @returns {number} steps to run this frame
   */
  advance(frameMs, speed = 1) {
    this.accumulator += Math.min(Math.max(frameMs, 0), this.maxFrameMs) * speed;
    let steps = Math.floor(this.accumulator / this.stepMs);
    if (steps > this.maxStepsPerFrame) {
      steps = this.maxStepsPerFrame;
      this.accumulator = 0; // too far behind: drop the backlog instead of spiralling
    } else {
      this.accumulator -= steps * this.stepMs;
    }
    return steps;
  }

  /** How far the time left over is into the next step (0..1), for drawing between two steps. */
  get alpha() {
    return this.accumulator / this.stepMs;
  }

  reset() {
    this.accumulator = 0;
  }
}
