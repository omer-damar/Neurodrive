// Draws the leader's NeuralNetwork on a 2D canvas: one column per layer, edges coloured by the
// weight's sign and as thick as its size, nodes filled by the current activation (tanh, -1..1).
// Reads the brain, never changes it. layoutNetwork() is pure and tested in Node.
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
const MIN_EDGE_WIDTH = 0.4;
const EDGE_WIDTH_RANGE = 2.6; // extra px for the largest weight
const MIN_EDGE_ALPHA = 0.12;
const EDGE_ALPHA_RANGE = 0.68;
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

export class NetworkView {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.layout = null;
    this.layoutSizes = '';
    this.ringColor = cssVar('--surface', '#171b21'); // surface ring keeps nodes apart from edges
    this.textColor = cssVar('--muted', '#8a94a3');
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
    if (!brain || this.width === 0) return;
    const key = brain.sizes.join(',');
    if (key !== this.layoutSizes) {
      this.layout = layoutNetwork(brain.sizes, this.width, this.height);
      this.layoutSizes = key;
    }
    const { layers, radius } = this.layout;
    this.#drawEdges(brain, layers);
    this.#drawNodes(brain, layers, radius);
    this.#drawLabels(brain, layers, radius);
  }

  #drawEdges(brain, layers) {
    const ctx = this.ctx;
    let maxAbs = 0;
    for (const w of brain.weights) for (let i = 0; i < w.length; i++) maxAbs = Math.max(maxAbs, Math.abs(w[i]));
    if (maxAbs === 0) return;
    for (let l = 0; l < brain.weights.length; l++) {
      const w = brain.weights[l];
      const from = layers[l];
      const to = layers[l + 1];
      for (let o = 0; o < to.length; o++) {
        for (let i = 0; i < from.length; i++) {
          const value = w[o * from.length + i];
          const size = Math.abs(value) / maxAbs;
          const [r, g, b] = value >= 0 ? NETWORK_COLORS.positive : NETWORK_COLORS.negative;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${MIN_EDGE_ALPHA + EDGE_ALPHA_RANGE * size})`;
          ctx.lineWidth = MIN_EDGE_WIDTH + EDGE_WIDTH_RANGE * size;
          ctx.beginPath();
          ctx.moveTo(from[i].x, from[i].y);
          ctx.lineTo(to[o].x, to[o].y);
          ctx.stroke();
        }
      }
    }
  }

  #drawNodes(brain, layers, radius) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.ringColor;
    layers.forEach((layer, l) => {
      const acts = brain.activations[l];
      layer.forEach((node, k) => {
        ctx.fillStyle = activationColor(acts[k]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
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
    const inputs = layers[0];
    const rays = brain.sizes[0] - 1;
    ctx.textAlign = 'right';
    inputs.forEach((node, i) => {
      const label = i < rays ? t('network.sensor', { n: i + 1 }) : t('network.speed');
      ctx.fillText(label, node.x - radius - LABEL_GAP, node.y);
    });
    const outputs = layers[layers.length - 1];
    const names = [t('network.steer'), t('network.throttle')];
    ctx.textAlign = 'left';
    outputs.forEach((node, i) => ctx.fillText(names[i] ?? '', node.x + radius + LABEL_GAP, node.y));
  }
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
