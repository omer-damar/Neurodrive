// "Draw track" mode on the 2D canvas: the world rectangle is fitted to the canvas, one pointer
// stroke (mouse, pen or finger) is collected in world units and handed to onFinish on release.
// Turning the stroke into a Track is core logic (core/trackSketch.js).
import { TRACK_WIDTH, WORLD_WIDTH, WORLD_HEIGHT } from '../core/config.js';
import { clampToWorld } from '../core/trackSketch.js';

const COLORS = {
  grass: '#16221a',
  frame: '#3a4a3e',
  road: 'rgba(43, 48, 56, 0.9)',
  centre: '#4fd1a5',
  start: '#ffd166',
};
const MARGIN_PX = 24;
const FRAME_DASH = [10, 8];
const START_RADIUS = 9; // world units
const MIN_SAMPLE_DISTANCE = 2; // world units between collected pointer samples

export class TrackEditor {
  /**
   * @param {HTMLCanvasElement} canvas the 2D view's canvas (the editor draws while it is active)
   * @param {{ onFinish: (points: number[][]) => void }} callbacks
   */
  constructor(canvas, { onFinish }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onFinish = onFinish;
    this.active = false;
    this.drawing = false;
    this.points = [];
    this.pointerId = null;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dpr = 1;
    this.handlers = {
      pointerdown: (event) => this.#onDown(event),
      pointermove: (event) => this.#onMove(event),
      pointerup: (event) => this.#onUp(event),
      pointercancel: () => this.#reset(),
    };
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.#reset();
    this.canvas.classList.add('is-editing');
    for (const [type, handler] of Object.entries(this.handlers)) this.canvas.addEventListener(type, handler);
    this.resize();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.#reset();
    this.canvas.classList.remove('is-editing');
    for (const [type, handler] of Object.entries(this.handlers)) this.canvas.removeEventListener(type, handler);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    const availW = Math.max(1, rect.width - MARGIN_PX * 2);
    const availH = Math.max(1, rect.height - MARGIN_PX * 2);
    this.scale = Math.min(availW / WORLD_WIDTH, availH / WORLD_HEIGHT);
    this.offsetX = (rect.width - WORLD_WIDTH * this.scale) / 2;
    this.offsetY = (rect.height - WORLD_HEIGHT * this.scale) / 2;
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, this.dpr * this.offsetX, this.dpr * this.offsetY);

    ctx.strokeStyle = COLORS.frame;
    ctx.lineWidth = 2 / this.scale;
    ctx.setLineDash(FRAME_DASH.map((d) => d / this.scale));
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.setLineDash([]);

    const pts = this.points;
    if (pts.length === 0) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // The band shows the real road width, so the user sees where two parts would touch.
    ctx.strokeStyle = COLORS.road;
    ctx.lineWidth = TRACK_WIDTH;
    this.#strokePath();
    ctx.strokeStyle = COLORS.centre;
    ctx.lineWidth = 2 / this.scale;
    this.#strokePath();
    ctx.fillStyle = COLORS.start;
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], START_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  #strokePath() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.points[0][0], this.points[0][1]);
    for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i][0], this.points[i][1]);
    ctx.stroke();
  }

  #toWorld(event) {
    const rect = this.canvas.getBoundingClientRect();
    return clampToWorld(
      (event.clientX - rect.left - this.offsetX) / this.scale,
      (event.clientY - rect.top - this.offsetY) / this.scale,
    );
  }

  #onDown(event) {
    if (this.drawing) return;
    event.preventDefault();
    this.drawing = true;
    this.pointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.points = [this.#toWorld(event)];
  }

  #onMove(event) {
    if (!this.drawing || event.pointerId !== this.pointerId) return;
    const point = this.#toWorld(event);
    const last = this.points[this.points.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= MIN_SAMPLE_DISTANCE) this.points.push(point);
  }

  #onUp(event) {
    if (!this.drawing || event.pointerId !== this.pointerId) return;
    const points = this.points;
    this.drawing = false;
    this.pointerId = null;
    this.onFinish(points);
  }

  #reset() {
    this.drawing = false;
    this.pointerId = null;
    this.points = [];
  }
}
