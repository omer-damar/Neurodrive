// Hand-written feed-forward network (tanh everywhere) with the genetic operators the GA needs.
import { WEIGHT_INIT_RANGE, BRAIN_FORMAT_VERSION, RAY_RANGE, RAY_SPREAD } from './config.js';
import { gaussian } from './math.js';

export class NeuralNetwork {
  /**
   * @param {number[]} sizes layer sizes, e.g. [8, 6, 2]
   * @param {(() => number) | null} [rng] seeded RNG for U(-1, 1) init; null leaves weights at 0
   * @param {{ rayCount: number, rayRange: number, raySpread: number }} [sensor]
   *   sensor layout the brain was trained with; saved alongside the weights
   */
  constructor(sizes, rng = null, sensor = null) {
    this.sizes = sizes.slice();
    this.sensor = sensor ?? { rayCount: sizes[0] - 1, rayRange: RAY_RANGE, raySpread: RAY_SPREAD };
    this.weights = []; // layer l: Float64Array(out × in), row-major by output neuron
    this.biases = [];
    this.activations = sizes.map((size) => new Float64Array(size)); // kept for visualization
    for (let l = 0; l < sizes.length - 1; l++) {
      const w = new Float64Array(sizes[l + 1] * sizes[l]);
      const b = new Float64Array(sizes[l + 1]);
      if (rng) {
        for (let i = 0; i < w.length; i++) w[i] = (rng() * 2 - 1) * WEIGHT_INIT_RANGE;
        for (let i = 0; i < b.length; i++) b[i] = (rng() * 2 - 1) * WEIGHT_INIT_RANGE;
      }
      this.weights.push(w);
      this.biases.push(b);
    }
  }

  /**
   * @param {ArrayLike<number>} inputs length sizes[0]
   * @returns {Float64Array} output activations (reused buffer; read before the next call)
   */
  feedForward(inputs) {
    const acts = this.activations;
    acts[0].set(inputs);
    for (let l = 0; l < this.weights.length; l++) {
      const input = acts[l];
      const output = acts[l + 1];
      const w = this.weights[l];
      const b = this.biases[l];
      const nIn = input.length;
      for (let o = 0; o < output.length; o++) {
        let sum = b[o];
        const row = o * nIn;
        for (let i = 0; i < nIn; i++) sum += w[row + i] * input[i];
        output[o] = Math.tanh(sum);
      }
    }
    return acts[acts.length - 1];
  }

  clone() {
    const copy = new NeuralNetwork(this.sizes, null, { ...this.sensor });
    for (let l = 0; l < this.weights.length; l++) {
      copy.weights[l].set(this.weights[l]);
      copy.biases[l].set(this.biases[l]);
    }
    return copy;
  }

  /** Each gene (weight or bias) changes with probability `rate` by gaussian × strength. In place. */
  mutate(rate, strength, rng) {
    for (const genes of [...this.weights, ...this.biases]) {
      for (let i = 0; i < genes.length; i++) {
        if (rng() < rate) genes[i] += gaussian(rng) * strength;
      }
    }
    return this;
  }

  /** Uniform crossover: every gene comes from parent a or b with equal probability. */
  static crossover(a, b, rng) {
    const child = new NeuralNetwork(a.sizes, null, { ...a.sensor });
    for (let l = 0; l < a.weights.length; l++) {
      pick(child.weights[l], a.weights[l], b.weights[l], rng);
      pick(child.biases[l], a.biases[l], b.biases[l], rng);
    }
    return child;
  }

  toJSON() {
    return {
      version: BRAIN_FORMAT_VERSION,
      sizes: this.sizes.slice(),
      weights: this.weights.map((w) => Array.from(w)),
      biases: this.biases.map((b) => Array.from(b)),
      sensor: { ...this.sensor },
    };
  }

  /** Rebuilds a network from toJSON() output; throws on an unknown version or a malformed file. */
  static fromJSON(json) {
    if (json?.version !== BRAIN_FORMAT_VERSION) throw new Error(`Unsupported brain version: ${json?.version}`);
    validateBrainJSON(json);
    const net = new NeuralNetwork(json.sizes, null, { ...json.sensor });
    json.weights.forEach((w, l) => net.weights[l].set(w));
    json.biases.forEach((b, l) => net.biases[l].set(b));
    return net;
  }
}

// Brains also come from user files, so every shape and number is checked before use.
function validateBrainJSON(json) {
  const { sizes, weights, biases, sensor } = json;
  const fail = (what) => {
    throw new Error(`Invalid brain: ${what}`);
  };
  if (!Array.isArray(sizes) || sizes.length < 2 || !sizes.every((n) => Number.isInteger(n) && n > 0)) fail('sizes');
  if (!Array.isArray(weights) || weights.length !== sizes.length - 1) fail('weights');
  if (!Array.isArray(biases) || biases.length !== sizes.length - 1) fail('biases');
  for (let l = 0; l < sizes.length - 1; l++) {
    if (!isNumberArray(weights[l], sizes[l + 1] * sizes[l])) fail(`weights[${l}]`);
    if (!isNumberArray(biases[l], sizes[l + 1])) fail(`biases[${l}]`);
  }
  if (!sensor || sensor.rayCount !== sizes[0] - 1) fail('sensor.rayCount');
  if (!(sensor.rayRange > 0) || !(sensor.raySpread > 0)) fail('sensor range or spread');
}

function isNumberArray(values, length) {
  return Array.isArray(values) && values.length === length && values.every(Number.isFinite);
}

function pick(out, a, b, rng) {
  for (let i = 0; i < out.length; i++) out[i] = rng() < 0.5 ? a[i] : b[i];
}
