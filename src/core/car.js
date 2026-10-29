// One car: fixed-step physics, wall collision, progress tracking and termination rules.
import {
  ACCEL,
  FRICTION,
  MAX_SPEED,
  TURN_RATE,
  GRIP_FULL_SPEED,
  HIGH_SPEED_GRIP_LOSS,
  CAR_LENGTH,
  CAR_WIDTH,
  STUCK_STEPS,
  REVERSE_TOLERANCE,
  LAPS,
  RAY_COUNT,
  RAY_RANGE,
  RAY_SPREAD,
} from './config.js';
import { clamp, segmentIntersectT, wrapDelta } from './math.js';

export const DEATH_CAUSES = Object.freeze({ WALL: 'wall', STUCK: 'stuck', REVERSE: 'reverse' });

export class Car {
  /**
   * @param {import('./track.js').Track} track
   * @param {{ stuckSteps?: number, reverseTolerance?: number, laps?: number,
   *           rayCount?: number, rayRange?: number, raySpread?: number, laneOffset?: number }} [options]
   *   Manual driving passes stuckSteps: Infinity so a human can stand still. laneOffset starts the
   *   car this far right (negative: left) of the centre line, so two racers do not overlap.
   */
  constructor(track, options = {}) {
    this.laneOffset = options.laneOffset ?? 0;
    this.stuckSteps = options.stuckSteps ?? STUCK_STEPS;
    this.reverseTolerance = options.reverseTolerance ?? REVERSE_TOLERANCE;
    this.laps = options.laps ?? LAPS;
    this.rayCount = options.rayCount ?? RAY_COUNT;
    this.rayRange = options.rayRange ?? RAY_RANGE;
    this.raySpread = options.raySpread ?? RAY_SPREAD;
    this.corners = new Float64Array(8); // body corners, FL FR RR RL; also read by renderers
    this.sensors = new Float64Array(this.rayCount); // 1 - distance / range: 0 = clear, 1 = touching
    this.rayEnds = new Float64Array(this.rayCount * 2); // hit point, or the ray tip when clear
    this.inputs = new Float64Array(this.rayCount + 1); // sensors + normalized speed, for the brain
    this.lapSteps = [];
    this.reset(track);
  }

  reset(track = this.track) {
    this.track = track;
    this.angle = track.startAngle;
    // Right of the heading in screen space (y down) is (-sin, cos).
    this.x = track.startX - Math.sin(this.angle) * this.laneOffset;
    this.y = track.startY + Math.cos(this.angle) * this.laneOffset;
    this.speed = 0;
    this.steer = 0;
    this.alive = true;
    this.finished = false;
    this.deathCause = null;
    this.trackIdx = 0;
    this.progress = 0; // centre-point indices travelled, signed (one lap = track.n)
    this.maxProgress = 0;
    this.stepsSinceImprove = 0;
    this.steps = 0;
    this.finishStep = -1;
    this.lapSteps.length = 0;
    this.#keepPose();
    this.#updateCorners();
    this.sense();
  }

  // Pose before the latest step, so renderers can draw between two steps (high refresh-rate screens).
  #keepPose() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAngle = this.angle;
  }

  /**
   * Casts the ray fan against nearby walls and fills `sensors`, `rayEnds` and `inputs`.
   * Rays spread evenly over ±raySpread/2 around the heading, from left to right.
   */
  sense() {
    const count = this.rayCount;
    const range = this.rayRange;
    const grid = this.track.grid;
    const s = this.track.segments;
    for (let r = 0; r < count; r++) {
      const offset = count === 1 ? 0 : -this.raySpread / 2 + (this.raySpread * r) / (count - 1);
      const a = this.angle + offset;
      const ex = this.x + Math.cos(a) * range;
      const ey = this.y + Math.sin(a) * range;
      let nearest = 1;
      const found = grid.queryBox(this.x, this.y, ex, ey);
      for (let k = 0; k < found; k++) {
        const o = grid.result[k] * 4;
        const t = segmentIntersectT(this.x, this.y, ex, ey, s[o], s[o + 1], s[o + 2], s[o + 3]);
        if (t >= 0 && t < nearest) nearest = t;
      }
      this.sensors[r] = 1 - nearest;
      this.inputs[r] = 1 - nearest;
      this.rayEnds[r * 2] = this.x + (ex - this.x) * nearest;
      this.rayEnds[r * 2 + 1] = this.y + (ey - this.y) * nearest;
    }
    this.inputs[count] = this.speed / MAX_SPEED;
  }

  /** Completed laps (capped at the race length). */
  get lap() {
    return Math.min(Math.floor(this.maxProgress / this.track.n), this.laps);
  }

  /**
   * Advances one fixed step.
   * @param {number} throttle -1 (brake) .. 1 (full gas)
   * @param {number} steer -1 (left) .. 1 (right), in screen space with y pointing down
   */
  update(throttle, steer) {
    if (!this.alive || this.finished) return;
    this.#keepPose();
    throttle = clamp(throttle, -1, 1);
    steer = clamp(steer, -1, 1);

    let speed = (this.speed + throttle * ACCEL) * FRICTION;
    speed = clamp(speed, 0, MAX_SPEED); // no reverse gear
    const grip = clamp(speed / GRIP_FULL_SPEED, 0, 1) * (1 - HIGH_SPEED_GRIP_LOSS * (speed / MAX_SPEED));
    this.angle += steer * TURN_RATE * grip;
    this.x += Math.cos(this.angle) * speed;
    this.y += Math.sin(this.angle) * speed;
    this.speed = speed;
    this.steer = steer;
    this.steps++;

    this.#updateCorners();
    if (this.#hitsWall()) {
      this.#die(DEATH_CAUSES.WALL);
      return;
    }
    this.updateProgress();
  }

  /** Re-reads the nearest track index and applies lap, finish, stuck and reverse rules. */
  updateProgress() {
    const track = this.track;
    const n = track.n;
    const idx = track.nearestIndex(this.x, this.y, this.trackIdx);
    this.progress += wrapDelta(idx - this.trackIdx, n);
    this.trackIdx = idx;

    if (this.progress > this.maxProgress) {
      const lapsBefore = Math.floor(this.maxProgress / n);
      this.maxProgress = this.progress;
      for (let lap = lapsBefore + 1; lap <= Math.floor(this.maxProgress / n); lap++) {
        this.lapSteps.push(this.steps);
      }
      this.stepsSinceImprove = 0;
    } else {
      this.stepsSinceImprove++;
    }

    if (this.maxProgress >= this.laps * n) {
      this.finished = true;
      this.finishStep = this.steps;
      this.speed = 0;
    } else if (this.stepsSinceImprove > this.stuckSteps) {
      this.#die(DEATH_CAUSES.STUCK);
    } else if (this.progress < this.maxProgress - this.reverseTolerance) {
      this.#die(DEATH_CAUSES.REVERSE);
    }
  }

  /**
   * Puts a crashed car back on the centre line where it was, standing still and facing along the
   * track (race mode). Laps and progress are kept.
   */
  respawn() {
    const c = this.track.center;
    const i = this.trackIdx;
    const j = (i + 1) % this.track.n;
    this.x = c[i * 2];
    this.y = c[i * 2 + 1];
    this.angle = Math.atan2(c[j * 2 + 1] - c[i * 2 + 1], c[j * 2] - c[i * 2]);
    this.speed = 0;
    this.steer = 0;
    this.alive = true;
    this.deathCause = null;
    this.stepsSinceImprove = 0;
    this.#keepPose();
    this.#updateCorners();
    this.sense();
  }

  #die(cause) {
    this.alive = false;
    this.deathCause = cause;
    this.speed = 0;
  }

  #updateCorners() {
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    const hl = CAR_LENGTH / 2;
    const hw = CAR_WIDTH / 2;
    const k = this.corners;
    // Local (±hl, ±hw) rotated by angle; order FL, FR, RR, RL (left = -y side in screen space).
    k[0] = this.x + c * hl + s * hw; k[1] = this.y + s * hl - c * hw;
    k[2] = this.x + c * hl - s * hw; k[3] = this.y + s * hl + c * hw;
    k[4] = this.x - c * hl - s * hw; k[5] = this.y - s * hl + c * hw;
    k[6] = this.x - c * hl + s * hw; k[7] = this.y - s * hl - c * hw;
  }

  #hitsWall() {
    const k = this.corners;
    let minX = k[0];
    let maxX = k[0];
    let minY = k[1];
    let maxY = k[1];
    for (let i = 2; i < 8; i += 2) {
      if (k[i] < minX) minX = k[i];
      if (k[i] > maxX) maxX = k[i];
      if (k[i + 1] < minY) minY = k[i + 1];
      if (k[i + 1] > maxY) maxY = k[i + 1];
    }
    const grid = this.track.grid;
    const s = this.track.segments;
    const count = grid.queryBox(minX, minY, maxX, maxY);
    for (let r = 0; r < count; r++) {
      const o = grid.result[r] * 4;
      for (let e = 0; e < 8; e += 2) {
        const f = (e + 2) % 8;
        if (segmentIntersectT(k[e], k[e + 1], k[f], k[f + 1], s[o], s[o + 1], s[o + 2], s[o + 3]) >= 0) {
          return true;
        }
      }
    }
    return false;
  }
}
