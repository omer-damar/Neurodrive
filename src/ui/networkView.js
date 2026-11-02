// Draws the leader's NeuralNetwork on a 2D canvas: one column per layer, nodes filled by the
// current activation (tanh, -1..1). Edges show the signal flowing right now (weight × the source
// node's value): strong ones are bright and thick, weak ones fade to thin grey lines, so the paths
// behind the current decision stand out. Hovering (or tapping) a node keeps only its own edges and
// explains its value in a box under the canvas (a tooltip would cover the node's own edges).
// Reads the brain, never changes it. The layout, signal and hit-test helpers are pure and tested
// in Node.
import { t } from './i18n.js';

// Diverging pair (positive / negative) around a neutral grey, from the validated chart palette (dark).
export const NETWORK_COLORS = Object.freeze({
  positive: [0x39, 0x87, 0xe5],
  negative: [0xd9, 0x59, 0x26],
  neutral: [0x4a, 0x52, 0x5e],
});
const PADDING = Object.freeze({ left: 62, right: 70, top: 10, bottom: 10 });
const MAX_NODE_SPACING = 26; // px between nodes of a short layer
const MAX_NODE_RADIUS = 7;
const MIN_EDGE_WIDTH = 0.6;
const EDGE_WIDTH_RANGE = 3; // extra px for the strongest signal
const MIN_EDGE_ALPHA = 0.25;
const EDGE_ALPHA_RANGE = 0.7;
const WEAK_SIGNAL = 0.2; // below this share of the layer's strongest signal an edge is "weak"
const WEAK_EDGE = Object.freeze({ width: 0.5, alpha: 0.12 });
const FADED_ALPHA = 0.05; // edges not touching the hovered node
const HIT_SLOP = 5; // px around a node that still counts as hovering it
const TOP_SOURCES = 2; // strongest incoming signals listed in the detail box
const LABEL_GAP = 8;
const FONT = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Node centres for each layer: columns spread across the width, nodes centred vertically.
 * @param {number[]} sizes layer sizes, e.g. [8, 6, 2]
 * @returns {{ layers: { x: number, y: number }[][], radius: number }}
 */
export function layoutNetwork(sizes, width, height, padding = PADDING) {
  const innerWidth = Math.max(0, width - padding.left - padding.right);
  const innerHeight = Math.max(0, height - padding.top - padding.bottom);
  const largest = Math.max(...sizes);
  const spacing = Math.min(MAX_NODE_SPACING, largest > 1 ? innerHeight / (largest - 1) : innerHeight);
  const centreY = padding.top + innerHeight / 2;
  const layers = sizes.map((size, l) => {
    const x = padding.left + (sizes.length > 1 ? (l / (sizes.length - 1)) * innerWidth : innerWidth / 2);
    return Array.from({ length: size }, (_, i) => ({ x, y: centreY + (i - (size - 1) / 2) * spacing }));
  });
  return { layers, radius: Math.max(2, Math.min(MAX_NODE_RADIUS, spacing * 0.32)) };
}

/**
 * Signal on each edge of layer `l` right now: weight × the source node's activation, laid out like
 * the weights (row-major by target node). Also returns the largest absolute signal of the layer.
 * @param {Float64Array} [out] reused buffer
 * @returns {{ signals: Float64Array, max: number }}
 */
export function edgeSignals(brain, l, out = new Float64Array(brain.weights[l].length)) {
  const w = brain.weights[l];
  const source = brain.activations[l];
  const nIn = source.length;
  let max = 0;
  for (let k = 0; k < w.length; k++) {
    out[k] = w[k] * source[k % nIn];
    max = Math.max(max, Math.abs(out[k]));
  }
  return { signals: out, max };
}

/** The node under (x, y), or null: { layer, index }. */
export function nodeAt(layout, x, y, slop = HIT_SLOP) {
  const reach = (layout.radius + slop) ** 2;
  for (let l = 0; l < layout.layers.length; l++) {
    const layer = layout.layers[l];
    if (Math.abs(layer[0].x - x) > layout.radius + slop) continue;
    for (let i = 0; i < layer.length; i++) {
      if ((layer[i].x - x) ** 2 + (layer[i].y - y) ** 2 <= reach) return { layer: l, index: i };
    }
  }
  return null;
}

/**
 * The strongest incoming signals of a node (none for inputs), strongest first.
 * @returns {{ index: number, signal: number }[]}
 */
export function topSources(brain, layer, index, count = TOP_SOURCES) {
  if (layer === 0) return [];
  const { signals } = edgeSignals(brain, layer - 1);
  const nIn = brain.sizes[layer - 1];
  const list = [];
  for (let i = 0; i < nIn; i++) list.push({ index: i, signal: signals[index * nIn + i] });
  return list.sort((a, b) => Math.abs(b.signal) - Math.abs(a.signal)).slice(0, count);
}

export class NetworkView {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement | null} [detail] box under the canvas that explains the hovered node
   */
  constructor(canvas, detail = null) {
    this.canvas = canvas;
    this.detail = detail;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.layout = null;
    this.layoutSizes = '';
    this.brain = null; // last brain drawn, so hovering can redraw at once
    this.focus = null; // hovered node: { layer, index }
    this.signalBuffers = [];
    this.ringColor = cssVar('--surface', '#171b21'); // surface ring keeps nodes apart from edges
    this.textColor = cssVar('--muted', '#8a94a3');
    this.focusColor = cssVar('--text', '#e6e9ee');
    this.#bindPointer();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layoutSizes = ''; // recompute on the next render
  }

  /** @param {import('../core/neuralNetwork.js').NeuralNetwork | null} brain */
  render(brain) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.brain = brain;
    if (!brain || this.width === 0) {
      this.#setFocus(null);
      return;
    }
    const key = brain.sizes.join(',');
    if (key !== this.layoutSizes) {
      this.layout = layoutNetwork(brain.sizes, this.width, this.height);
      this.layoutSizes = key;
      this.focus = null; // the network changed shape under the pointer
    }
    const { layers, radius } = this.layout;
    this.#drawEdges(brain, layers);
    this.#drawNodes(brain, layers, radius);
    this.#drawLabels(brain, layers, radius);
    this.#updateDetail(brain);
  }

  // Two passes: weak and unfocused edges first as a faint background, strong ones on top.
  #drawEdges(brain, layers) {
    const ctx = this.ctx;
    const focus = this.focus;
    for (const strong of [false, true]) {
      for (let l = 0; l < brain.weights.length; l++) {
        if (this.signalBuffers[l]?.length !== brain.weights[l].length) {
          this.signalBuffers[l] = new Float64Array(brain.weights[l].length);
        }
        const { signals, max } = edgeSignals(brain, l, this.signalBuffers[l]);
        const from = layers[l];
        const to = layers[l + 1];
        for (let o = 0; o < to.length; o++) {
          for (let i = 0; i < from.length; i++) {
            const signal = signals[o * from.length + i];
            const size = max > 0 ? Math.abs(signal) / max : 0;
            const touches = focus === null ||
              (focus.layer === l && focus.index === i) || (focus.layer === l + 1 && focus.index === o);
            const isStrong = touches && (size >= WEAK_SIGNAL || focus !== null);
            if (isStrong !== strong) continue;
            if (!strong) {
              const [r, g, b] = NETWORK_COLORS.neutral;
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${touches ? WEAK_EDGE.alpha : FADED_ALPHA})`;
              ctx.lineWidth = WEAK_EDGE.width;
            } else {
              const [r, g, b] = signal >= 0 ? NETWORK_COLORS.positive : NETWORK_COLORS.negative;
              ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${MIN_EDGE_ALPHA + EDGE_ALPHA_RANGE * size})`;
              ctx.lineWidth = MIN_EDGE_WIDTH + EDGE_WIDTH_RANGE * size;
            }
            ctx.beginPath();
            ctx.moveTo(from[i].x, from[i].y);
            ctx.lineTo(to[o].x, to[o].y);
            ctx.stroke();
          }
        }
      }
    }
  }

  #drawNodes(brain, layers, radius) {
    const ctx = this.ctx;
    layers.forEach((layer, l) => {
      const acts = brain.activations[l];
      layer.forEach((node, k) => {
        const focused = this.focus !== null && this.focus.layer === l && this.focus.index === k;
        ctx.fillStyle = activationColor(acts[k]);
        ctx.lineWidth = focused ? 2 : 1.5;
        ctx.strokeStyle = focused ? this.focusColor : this.ringColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, focused ? radius + 1.5 : radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    });
  }

  #drawLabels(brain, layers, radius) {
    const ctx = this.ctx;
    ctx.font = FONT;
    ctx.fillStyle = this.textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    layers[0].forEach((node, i) => ctx.fillText(nodeName(brain, 0, i), node.x - radius - LABEL_GAP, node.y));
    const last = layers.length - 1;
    ctx.textAlign = 'left';
    layers[last].forEach((node, i) => ctx.fillText(nodeName(brain, last, i), node.x + radius + LABEL_GAP, node.y));
  }

  #bindPointer() {
    const move = (event) => {
      if (!this.layout) return;
      const rect = this.canvas.getBoundingClientRect();
      this.#setFocus(nodeAt(this.layout, event.clientX - rect.left, event.clientY - rect.top));
    };
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerdown', move); // a tap on touch screens
    this.canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') this.#setFocus(null); // a tap keeps its focus until the next tap
    });
  }

  #setFocus(node) {
    const same = node === this.focus ||
      (node && this.focus && node.layer === this.focus.layer && node.index === this.focus.index);
    if (same) return;
    this.focus = node;
    this.canvas.style.cursor = node ? 'pointer' : '';
    if (this.brain) this.render(this.brain); // redraw now, not at the next 10 Hz tick
    else this.#updateDetail(null);
  }

  #updateDetail(brain) {
    const box = this.detail;
    if (!box) return;
    if (!brain || !this.focus) {
      box.textContent = t('network.detail.empty');
      return;
    }
    const { layer, index } = this.focus;
    const value = brain.activations[layer][index];
    const name = document.createElement('strong');
    name.textContent = `${nodeName(brain, layer, index)} · ${formatValue(value)}`;
    const parts = [name, ` ${nodeMeaning(brain, layer, index, value)}`];
    const sources = topSources(brain, layer, index);
    if (sources.length) {
      const list = sources.map((s) => `${nodeName(brain, layer - 1, s.index)} ${formatValue(s.signal)}`).join(', ');
      parts.push(` ${t('network.tip.sources', { list })}`);
    }
    box.replaceChildren(...parts);
  }
}

// S1..Sn, speed, hidden k, steer, throttle.
function nodeName(brain, layer, index) {
  const last = brain.sizes.length - 1;
  if (layer === 0) return index < brain.sizes[0] - 1 ? t('network.sensor', { n: index + 1 }) : t('network.speed');
  if (layer === last) return index === 0 ? t('network.steer') : t('network.throttle');
  return t('network.hidden', { n: index + 1 });
}

// What the value means for the car, in words.
function nodeMeaning(brain, layer, index, value) {
  const last = brain.sizes.length - 1;
  if (layer === 0) return t(index < brain.sizes[0] - 1 ? 'network.tip.sensor' : 'network.tip.speed');
  if (layer === last && index === 0) return t(value < 0 ? 'network.tip.left' : 'network.tip.right');
  if (layer === last) return t(value < 0 ? 'network.tip.brake' : 'network.tip.gas');
  return t('network.tip.hidden');
}

function formatValue(value) {
  return (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(2);
}

// -1 -> negative hue, 0 -> neutral grey, +1 -> positive hue (linear mix in sRGB).
function activationColor(value) {
  const amount = Math.min(1, Math.abs(value));
  const target = value >= 0 ? NETWORK_COLORS.positive : NETWORK_COLORS.negative;
  const n = NETWORK_COLORS.neutral;
  const mix = (k) => Math.round(n[k] + (target[k] - n[k]) * amount);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
