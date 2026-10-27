// Canvas 2D top-down renderer. Reads the scene, never modifies it.
import { CAR_LENGTH, CAR_WIDTH } from '../core/config.js';

const COLORS = {
  grass: '#16221a',
  road: '#2b3038',
  curbRed: '#d64545',
  curbWhite: '#f2f2f2',
  carAlive: '#4fd1a5',
  carLeader: '#ffd166',
  carDead: '#6b7280',
  carFinished: '#f5c542',
  glass: '#10151c',
  tyre: '#0b0d10',
  headlight: '#fff6c2',
  taillight: '#ff4d4d',
  checkerDark: '#111111',
  checkerLight: '#f2f2f2',
};
const MARGIN_PX = 24;
const CURB_WIDTH = 4; // world units
const CURB_DASH = [12, 12];
const CHECKER_COLUMNS = 8;
const CHECKER_ROWS = 2;
const DEAD_ALPHA = 0.5;
const DIMMED_ALPHA = 0.25; // non-leader cars when view.dimOthers is on
const WHEEL_STEER_ANGLE = 0.45; // radians of visual front-wheel turn at full steer
const SENSOR_LINE_WIDTH = 1.2;
const SENSOR_HIT_RADIUS = 2.5;

// Top-down car outline in units of CAR_LENGTH / CAR_WIDTH (x forward, y right), drawn once per car.
const BODY_RADIUS = 0.22; // corner rounding, fraction of CAR_WIDTH
const WHEEL = { length: 0.2, width: 0.2, front: 0.3, rear: -0.3, side: 0.5 };
const WHEEL_XS = [WHEEL.front, WHEEL.rear];
const SIDES = [-1, 1];

export class Renderer2D {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = null;
    this.dpr = 1;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
  }

  setTrack(track) {
    this.track = track;
    this.bounds = track.bounds();
    this.roadPath = new Path2D();
    appendLoop(this.roadPath, track.outer);
    appendLoop(this.roadPath, track.inner);
    this.innerPath = new Path2D();
    appendLoop(this.innerPath, track.inner);
    this.outerPath = new Path2D();
    appendLoop(this.outerPath, track.outer);
    this.#fit();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.#fit();
  }

  /**
   * @param {{ track: object, cars: object[], leader: object | null }} scene
   * @param {{ highlightLeader?: boolean, showSensors?: boolean,
   *           visibleCount?: number, dimOthers?: boolean }} [view]
   *   visibleCount draws only the N furthest cars (the simulation still runs them all);
   *   dimOthers fades every car except the leader.
   */
  render(scene, view = {}) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.track) return;

    // World -> device pixels in a single transform; all drawing below is in world units.
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, this.dpr * this.offsetX, this.dpr * this.offsetY);

    ctx.fillStyle = COLORS.road;
    ctx.fill(this.roadPath, 'evenodd');
    this.#drawCurb(this.innerPath);
    this.#drawCurb(this.outerPath);
    this.#drawStartLine();

    const highlightLeader = view.highlightLeader ?? true;
    const leader = highlightLeader ? scene.leader : null;
    const otherAlpha = view.dimOthers ? DIMMED_ALPHA : 1;
    for (const car of this.#visibleCars(scene.cars, view.visibleCount ?? Infinity)) {
      if (car !== leader) this.#drawCar(car, false, otherAlpha);
    }
    if (leader) {
      if (view.showSensors ?? true) this.#drawSensors(leader);
      this.#drawCar(leader, true, 1);
    }
  }

  // Draw order: dead cars first so living ones stay on top. Reuses one array between frames.
  #visibleCars(cars, limit) {
    const list = (this.drawList ??= []);
    list.length = 0;
    for (const car of cars) list.push(car);
    if (limit < list.length) {
      list.sort((a, b) => b.maxProgress - a.maxProgress);
      list.length = limit;
    }
    list.sort((a, b) => Number(a.alive) - Number(b.alive));
    return list;
  }

  #drawSensors(car) {
    const ctx = this.ctx;
    ctx.lineWidth = SENSOR_LINE_WIDTH;
    for (let r = 0; r < car.sensors.length; r++) {
      const ex = car.rayEnds[r * 2];
      const ey = car.rayEnds[r * 2 + 1];
      const color = sensorColor(car.sensors[r]);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (car.sensors[r] > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(ex, ey, SENSOR_HIT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  dispose() {
    this.track = null;
    this.roadPath = this.innerPath = this.outerPath = null;
  }

  #fit() {
    if (!this.bounds) return;
    const { minX, minY, maxX, maxY } = this.bounds;
    const w = maxX - minX;
    const h = maxY - minY;
    const availW = Math.max(1, this.cssWidth - MARGIN_PX * 2);
    const availH = Math.max(1, this.cssHeight - MARGIN_PX * 2);
    this.scale = Math.min(availW / w, availH / h);
    this.offsetX = (this.cssWidth - w * this.scale) / 2 - minX * this.scale;
    this.offsetY = (this.cssHeight - h * this.scale) / 2 - minY * this.scale;
  }

  #drawCurb(path) {
    const ctx = this.ctx;
    ctx.lineWidth = CURB_WIDTH;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.curbRed;
    ctx.setLineDash([]);
    ctx.stroke(path);
    ctx.strokeStyle = COLORS.curbWhite;
    ctx.setLineDash(CURB_DASH);
    ctx.stroke(path);
    ctx.setLineDash([]);
  }

  #drawStartLine() {
    const { inner, outer, center } = this.track;
    const ctx = this.ctx;
    const ix = inner[0];
    const iy = inner[1];
    const ax = (outer[0] - ix) / CHECKER_COLUMNS; // one cell across the road
    const ay = (outer[1] - iy) / CHECKER_COLUMNS;
    let tx = center[2] - center[0];
    let ty = center[3] - center[1];
    const len = Math.hypot(tx, ty) || 1;
    const cell = Math.hypot(ax, ay);
    tx = (tx / len) * cell; // one cell along the road
    ty = (ty / len) * cell;
    for (let row = 0; row < CHECKER_ROWS; row++) {
      for (let col = 0; col < CHECKER_COLUMNS; col++) {
        const x = ix + ax * col + tx * (row - CHECKER_ROWS / 2);
        const y = iy + ay * col + ty * (row - CHECKER_ROWS / 2);
        ctx.fillStyle = (row + col) % 2 === 0 ? COLORS.checkerDark : COLORS.checkerLight;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ax, y + ay);
        ctx.lineTo(x + ax + tx, y + ay + ty);
        ctx.lineTo(x + tx, y + ty);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  #drawCar(car, isLeader, alpha) {
    const ctx = this.ctx;
    const L = CAR_LENGTH;
    const W = CAR_WIDTH;
    let body = isLeader ? COLORS.carLeader : COLORS.carAlive;
    if (!car.alive) {
      body = COLORS.carDead;
      alpha *= DEAD_ALPHA;
    } else if (car.finished) {
      body = COLORS.carFinished;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Tyres poke out slightly from under the body; front pair turns with steer.
    ctx.fillStyle = COLORS.tyre;
    const wl = WHEEL.length * L;
    const ww = WHEEL.width * W;
    for (const wx of WHEEL_XS) {
      for (const side of SIDES) {
        ctx.save();
        ctx.translate(wx * L, side * WHEEL.side * W);
        if (wx === WHEEL.front) ctx.rotate(car.steer * WHEEL_STEER_ANGLE);
        ctx.fillRect(-wl / 2, -ww / 2, wl, ww);
        ctx.restore();
      }
    }

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, BODY_RADIUS * W);
    ctx.fill();

    // Windscreen, roof and rear window.
    ctx.fillStyle = COLORS.glass;
    ctx.beginPath();
    ctx.moveTo(L * 0.2, -W * 0.36);
    ctx.lineTo(L * 0.2, W * 0.36);
    ctx.lineTo(L * 0.04, W * 0.3);
    ctx.lineTo(L * 0.04, -W * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-L * 0.32, -W * 0.28, L * 0.1, W * 0.56);

    ctx.fillStyle = COLORS.headlight;
    ctx.fillRect(L * 0.44, -W * 0.42, L * 0.06, W * 0.22);
    ctx.fillRect(L * 0.44, W * 0.2, L * 0.06, W * 0.22);
    ctx.fillStyle = COLORS.taillight;
    ctx.fillRect(-L * 0.5, -W * 0.42, L * 0.05, W * 0.2);
    ctx.fillRect(-L * 0.5, W * 0.22, L * 0.05, W * 0.2);
    ctx.restore();
  }
}

// 0 (clear) -> green, 1 (touching) -> red.
function sensorColor(value) {
  const hue = Math.round(120 * (1 - value));
  return `hsl(${hue} 85% 55%)`;
}

function appendLoop(path, flat) {
  path.moveTo(flat[0], flat[1]);
  for (let i = 2; i < flat.length; i += 2) path.lineTo(flat[i], flat[i + 1]);
  path.closePath();
}
