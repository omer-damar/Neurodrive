// Seeded randomness and small geometry helpers. All randomness in the project comes from here.

/**
 * Mulberry32 PRNG. Returns a function producing floats in [0, 1).
 * @param {number} seed
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box–Muller. */
export function gaussian(rng) {
  let u = 0;
  while (u === 0) u = rng(); // log(0) guard
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/**
 * Intersection of segment AB with segment CD.
 * Returns t ∈ [0, 1] along AB, or -1 when they do not intersect (parallel included).
 */
export function segmentIntersectT(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return -1;
  const qpx = cx - ax;
  const qpy = cy - ay;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return -1;
  return t;
}

/** Wraps an index difference on a closed loop of n points into [-n/2, n/2]. */
export function wrapDelta(delta, n) {
  const half = n / 2;
  if (delta > half) return delta - n;
  if (delta < -half) return delta + n;
  return delta;
}
