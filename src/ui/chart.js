// Best and average fitness per generation as two lines on a 2D canvas, with a crosshair and an HTML
// tooltip on hover. The scale helpers (niceScale, yTicks, xOf, indexAt) are pure and tested in Node.
import { t } from './i18n.js';

// Validated categorical palette, dark-surface steps (the app has a dark theme only).
export const CHART_COLORS = Object.freeze({ best: '#3987e5', avg: '#d95926' });
const SERIES = Object.freeze(['best', 'avg']);
const PADDING = Object.freeze({ left: 34, right: 10, top: 8, bottom: 20 });
const Y_TICKS = 4; // target number of intervals; the real count follows the round step
const LINE_WIDTH = 2;
const MARKER_RADIUS = 4; // 8 px markers on the hovered generation
const FONT = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const NICE_STEPS = Object.freeze([1, 2, 5, 10]);

/**
 * Axis from 0 with a round tick step (1, 2 or 5 × 10^k) giving about `count` intervals, and the
 * smallest multiple of that step covering the peak. Empty or non-positive data gives 0..1.
 */
export function niceScale(peak, count = Y_TICKS) {
  if (!(peak > 0)) return { max: 1, step: 0.25 };
  const rough = peak / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = NICE_STEPS.find((m) => m * power >= rough - 1e-12) * power;
  return { max: Math.ceil(peak / step - 1e-9) * step, step };
}

/** Tick values 0, step, 2·step … max. */
export function yTicks({ max, step }) {
  const count = Math.round(max / step);
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toFixed(10)));
}

/** x position of point i of n inside [left, left + width]; a single point sits in the middle. */
export function xOf(i, n, left, width) {
  return n <= 1 ? left + width / 2 : left + (i / (n - 1)) * width;
}

/** Index of the point nearest to x, clamped to [0, n - 1]; -1 when there are no points. */
export function indexAt(x, n, left, width) {
  if (n === 0) return -1;
  if (n === 1) return 0;
  const i = Math.round(((x - left) / width) * (n - 1));
  return Math.min(n - 1, Math.max(0, i));
}

export class FitnessChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} tooltip absolutely positioned element over the canvas
   * @param {HTMLElement} empty message shown until the first generation ends
   */
  constructor(canvas, tooltip, empty) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tooltip = tooltip;
    this.empty = empty;
    this.history = [];
    this.hover = -1;
    this.width = 0;
    this.height = 0;
    const style = getComputedStyle(document.documentElement);
    this.gridColor = style.getPropertyValue('--border').trim() || '#2a313b';
    this.textColor = style.getPropertyValue('--muted').trim() || '#8a94a3';
    this.ringColor = style.getPropertyValue('--surface').trim() || '#171b21';
    canvas.addEventListener('pointermove', (event) => this.#onPointer(event));
    canvas.addEventListener('pointerleave', () => this.#setHover(-1));
    this.resize();
  }

  /** @param {{ generation: number, best: number, avg: number }[]} history */
  setHistory(history) {
    this.history = history;
    this.empty.hidden = history.length > 0;
    if (this.hover >= history.length) this.hover = -1;
    this.render();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.width === 0) return;
    const plot = this.#plotArea();
    const n = this.history.length;
    let peak = 0;
    for (const stats of this.history) peak = Math.max(peak, stats.best, stats.avg);
    if (n === 0) return; // the empty-state message stands alone
    const scale = niceScale(peak);
    const max = scale.max;
    const yOf = (value) => plot.top + plot.height * (1 - value / max);

    ctx.font = FONT;
    ctx.lineWidth = 1;
    ctx.fillStyle = this.textColor;
    ctx.strokeStyle = this.gridColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const tick of yTicks(scale)) {
      const y = Math.round(yOf(tick)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(plot.left, y);
      ctx.lineTo(plot.left + plot.width, y);
      ctx.stroke();
      ctx.fillText(formatTick(tick), plot.left - 6, y);
    }

    ctx.textBaseline = 'top';
    const axisY = plot.top + plot.height + 5;
    ctx.textAlign = n === 1 ? 'center' : 'left';
    ctx.fillText(String(this.history[0].generation), xOf(0, n, plot.left, plot.width), axisY);
    if (n > 1) {
      ctx.textAlign = 'right';
      ctx.fillText(String(this.history[n - 1].generation), plot.left + plot.width, axisY);
    }

    ctx.lineWidth = LINE_WIDTH;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const key of SERIES) {
      ctx.strokeStyle = CHART_COLORS[key];
      ctx.fillStyle = CHART_COLORS[key];
      ctx.beginPath();
      if (n === 1) {
        // A single generation has no line yet: show it as a dot.
        ctx.arc(xOf(0, n, plot.left, plot.width), yOf(this.history[0][key]), MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      this.history.forEach((stats, i) => {
        const x = xOf(i, n, plot.left, plot.width);
        if (i === 0) ctx.moveTo(x, yOf(stats[key]));
        else ctx.lineTo(x, yOf(stats[key]));
      });
      ctx.stroke();
    }

    if (this.hover >= 0) this.#drawHover(plot, n, yOf);
  }

  #drawHover(plot, n, yOf) {
    const ctx = this.ctx;
    const stats = this.history[this.hover];
    const x = xOf(this.hover, n, plot.left, plot.width);
    ctx.strokeStyle = this.textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, plot.top);
    ctx.lineTo(Math.round(x) + 0.5, plot.top + plot.height);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.ringColor;
    for (const key of SERIES) {
      ctx.fillStyle = CHART_COLORS[key];
      ctx.beginPath();
      ctx.arc(x, yOf(stats[key]), MARKER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  #plotArea() {
    return {
      left: PADDING.left,
      top: PADDING.top,
      width: Math.max(1, this.width - PADDING.left - PADDING.right),
      height: Math.max(1, this.height - PADDING.top - PADDING.bottom),
    };
  }

  #onPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const plot = this.#plotArea();
    this.#setHover(indexAt(event.clientX - rect.left, this.history.length, plot.left, plot.width));
  }

  #setHover(index) {
    if (index === this.hover) return;
    this.hover = index;
    this.render();
    this.#updateTooltip();
  }

  #updateTooltip() {
    const tip = this.tooltip;
    if (this.hover < 0) {
      tip.hidden = true;
      return;
    }
    const stats = this.history[this.hover];
    tip.replaceChildren(
      line('chart-tip-title', t('chart.tooltip', { generation: stats.generation })),
      seriesLine('best', stats.best),
      seriesLine('avg', stats.avg),
    );
    tip.hidden = false;
    const plot = this.#plotArea();
    const x = xOf(this.hover, this.history.length, plot.left, plot.width);
    // Keep the tooltip inside the chart: flip to the left of the crosshair past the middle.
    const flip = x > this.width / 2;
    tip.style.left = flip ? 'auto' : `${x + 10}px`;
    tip.style.right = flip ? `${this.width - x + 10}px` : 'auto';
  }
}

function formatTick(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function line(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

function seriesLine(key, value) {
  const row = document.createElement('div');
  row.className = 'chart-tip-row';
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = CHART_COLORS[key];
  const label = document.createElement('span');
  label.textContent = t(`chart.${key}`);
  const number = document.createElement('span');
  number.className = 'chart-tip-value';
  number.textContent = value.toFixed(3);
  row.append(swatch, label, number);
  return row;
}
