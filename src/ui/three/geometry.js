// Pure geometry for the 3D view: Track -> typed arrays. No three.js import, so it is tested in Node.
// The single 2D -> 3D mapping lives here: world (x, y) -> three.js (x·SCALE, 0, y·SCALE),
// world angle -> rotation.y = -angle.
import { SCALE } from '../../core/config.js';

export const ROAD_Y = 0; // road surface height (m)
const START_LINE_Y = 0.01; // just above the road to avoid z-fighting
const BARRIER_STRIPE_SEGMENTS = 2; // barrier colour changes every N wall segments
const CHECKER_COLUMNS = 8;
const CHECKER_ROWS = 2;

export const BARRIER_COLORS = Object.freeze({
  red: Object.freeze([0.84, 0.16, 0.16]),
  white: Object.freeze([0.95, 0.95, 0.95]),
});
const CHECKER_COLORS = [
  [0.07, 0.07, 0.07],
  [0.95, 0.95, 0.95],
];

/** World (x, y) -> three.js [X, Y, Z]. */
export function toWorld3(x, y, height = 0) {
  return [x * SCALE, height, y * SCALE];
}

/** World heading angle -> three.js rotation around Y. */
export function toRotationY(angle) {
  return -angle;
}

/**
 * Road surface as a triangle strip between the inner and outer walls.
 * The first point pair is repeated at the end so the texture coordinate v can run continuously
 * from 0 to the full lap length without a seam: 2(n + 1) vertices, 6n indices.
 * u = 0 on the inner edge, 1 on the outer edge; v = distance along the centre line in metres.
 */
export function buildRoadStrip(track) {
  const n = track.n;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const indices = new Uint32Array(n * 6);
  const c = track.center;
  let v = 0;
  for (let k = 0; k <= n; k++) {
    const i = k % n;
    if (k > 0) {
      const p = k - 1;
      v += Math.hypot(c[i * 2] - c[p * 2], c[i * 2 + 1] - c[p * 2 + 1]) * SCALE;
    }
    positions.set(toWorld3(track.inner[i * 2], track.inner[i * 2 + 1], ROAD_Y), k * 6);
    positions.set(toWorld3(track.outer[i * 2], track.outer[i * 2 + 1], ROAD_Y), k * 6 + 3);
    uvs.set([0, v, 1, v], k * 4);
  }
  for (let k = 0; k < n; k++) {
    const a = k * 2; // inner k
    const b = a + 1; // outer k
    const c2 = a + 2; // inner k+1
    const d = a + 3; // outer k+1
    // Counter-clockwise seen from above (+Y), so normals point up.
    indices.set([a, c2, b, b, c2, d], k * 6);
  }
  return { positions, uvs, indices };
}

/**
 * Vertical wall along a closed loop of points. Each segment is its own quad (4 vertices) so the
 * red/white stripes stay crisp: 4n vertices, 6n indices, one RGB colour per vertex.
 * @param {Float64Array} points flat [x, y, ...] world coordinates (track.inner or track.outer)
 * @param {number} height metres
 */
export function buildBarrier(points, height) {
  const n = points.length / 2;
  const positions = new Float32Array(n * 4 * 3);
  const colors = new Float32Array(n * 4 * 3);
  const indices = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const base = i * 4;
    positions.set(toWorld3(points[i * 2], points[i * 2 + 1], 0), base * 3);
    positions.set(toWorld3(points[j * 2], points[j * 2 + 1], 0), (base + 1) * 3);
    positions.set(toWorld3(points[j * 2], points[j * 2 + 1], height), (base + 2) * 3);
    positions.set(toWorld3(points[i * 2], points[i * 2 + 1], height), (base + 3) * 3);
    const color = barrierColor(i);
    for (let k = 0; k < 4; k++) colors.set(color, (base + k) * 3);
    indices.set([base, base + 1, base + 2, base, base + 2, base + 3], i * 6);
  }
  return { positions, colors, indices };
}

export function barrierColor(segment) {
  return Math.floor(segment / BARRIER_STRIPE_SEGMENTS) % 2 === 0 ? BARRIER_COLORS.red : BARRIER_COLORS.white;
}

/** Checkered start/finish line across the road at index 0 (quads with per-vertex colours). */
export function buildStartLine(track) {
  const quads = CHECKER_COLUMNS * CHECKER_ROWS;
  const positions = new Float32Array(quads * 4 * 3);
  const colors = new Float32Array(quads * 4 * 3);
  const indices = new Uint32Array(quads * 6);
  const { inner, outer, center } = track;
  const ax = (outer[0] - inner[0]) / CHECKER_COLUMNS; // one cell across the road
  const ay = (outer[1] - inner[1]) / CHECKER_COLUMNS;
  const cell = Math.hypot(ax, ay);
  const len = Math.hypot(center[2] - center[0], center[3] - center[1]) || 1;
  const tx = ((center[2] - center[0]) / len) * cell; // one cell along the road
  const ty = ((center[3] - center[1]) / len) * cell;
  let q = 0;
  for (let row = 0; row < CHECKER_ROWS; row++) {
    for (let col = 0; col < CHECKER_COLUMNS; col++) {
      const x = inner[0] + ax * col + tx * (row - CHECKER_ROWS / 2);
      const y = inner[1] + ay * col + ty * (row - CHECKER_ROWS / 2);
      const corners = [
        [x, y],
        [x + ax, y + ay],
        [x + ax + tx, y + ay + ty],
        [x + tx, y + ty],
      ];
      const base = q * 4;
      const color = CHECKER_COLORS[(row + col) % 2];
      corners.forEach(([cx, cy], k) => {
        positions.set(toWorld3(cx, cy, START_LINE_Y), (base + k) * 3);
        colors.set(color, (base + k) * 3);
      });
      indices.set(upFacingQuad(positions, base), q * 6);
      q++;
    }
  }
  return { positions, colors, indices };
}

/** Axis-aligned bounds of the track in three.js metres: { minX, maxX, minZ, maxZ, cx, cz, size }. */
export function trackBounds3(track) {
  const b = track.bounds();
  const minX = b.minX * SCALE;
  const maxX = b.maxX * SCALE;
  const minZ = b.minY * SCALE;
  const maxZ = b.maxY * SCALE;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    size: Math.max(maxX - minX, maxZ - minZ),
  };
}

// The checker corners' winding depends on track direction, so pick the triangle order that faces +Y.
function upFacingQuad(positions, base) {
  const p = (k) => [positions[(base + k) * 3], positions[(base + k) * 3 + 2]];
  const [x0, z0] = p(0);
  const [x1, z1] = p(1);
  const [x2, z2] = p(2);
  // y component of (p1 - p0) × (p2 - p0); positive means the normal points up.
  const up = (z1 - z0) * (x2 - x0) - (x1 - x0) * (z2 - z0) > 0;
  return up
    ? [base, base + 1, base + 2, base, base + 2, base + 3]
    : [base, base + 2, base + 1, base, base + 3, base + 2];
}
