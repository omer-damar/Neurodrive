// Closed-loop track: control points -> Catmull-Rom centre line -> walls, grid, validation, progress.
import {
  TRACK_WIDTH,
  RESAMPLE_SPACING,
  SPLINE_SUBDIVISIONS,
  MIN_CONTROL_POINTS,
  SHARP_TURN_WINDOW,
  NEAREST_SEARCH_WINDOW,
} from './config.js';
import { segmentIntersectT } from './math.js';
import { SegmentGrid } from './segmentGrid.js';

// Hand-designed presets in the 1200×800 world. Every preset must pass validate() (see tests).
export const PRESETS = Object.freeze({
  oval: [
    [1050, 400], [990, 530], [825, 625], [600, 660], [375, 625], [210, 530],
    [150, 400], [210, 270], [375, 175], [600, 140], [825, 175], [990, 270],
  ],
  classic: [
    [250, 130], [600, 120], [950, 140], [1090, 260], [1080, 430], [960, 580], [790, 650],
    [640, 560], [490, 640], [300, 670], [150, 570], [110, 390], [140, 220],
  ],
  technical: [
    [150, 150], [450, 110], [700, 180], [820, 320], [1000, 260], [1100, 380], [1050, 560],
    [880, 660], [700, 600], [560, 480], [430, 560], [340, 670], [200, 670], [120, 530],
    [180, 390], [110, 260],
  ],
});

export const TRACK_ERRORS = Object.freeze({
  TOO_FEW_POINTS: 'TOO_FEW_POINTS',
  SHARP_TURN: 'SHARP_TURN',
  SECTIONS_TOO_CLOSE: 'SECTIONS_TOO_CLOSE',
});

export class Track {
  /**
   * @param {number[][]} controlPoints closed loop of [x, y]; either winding is accepted
   * @param {number} [width]
   */
  constructor(controlPoints, width = TRACK_WIDTH) {
    this.width = width;
    this.controlPoints = normalizeWinding(controlPoints.map(([x, y]) => [x, y]));

    const dense = sampleCatmullRom(this.controlPoints, SPLINE_SUBDIVISIONS);
    this.center = resampleClosed(dense, RESAMPLE_SPACING);
    const n = this.center.length / 2;
    this.n = n;

    // Outward normal = right-hand normal of the travel direction (winding is normalized above).
    this.normals = new Float64Array(n * 2);
    this.inner = new Float64Array(n * 2);
    this.outer = new Float64Array(n * 2);
    const half = width / 2;
    const c = this.center;
    for (let i = 0; i < n; i++) {
      const p = (i - 1 + n) % n;
      const q = (i + 1) % n;
      const [ax, ay] = unitRightNormal(c[p * 2], c[p * 2 + 1], c[i * 2], c[i * 2 + 1]);
      const [bx, by] = unitRightNormal(c[i * 2], c[i * 2 + 1], c[q * 2], c[q * 2 + 1]);
      let nx = ax + bx;
      let ny = ay + by;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      this.normals[i * 2] = nx;
      this.normals[i * 2 + 1] = ny;
      this.inner[i * 2] = c[i * 2] - nx * half;
      this.inner[i * 2 + 1] = c[i * 2 + 1] - ny * half;
      this.outer[i * 2] = c[i * 2] + nx * half;
      this.outer[i * 2 + 1] = c[i * 2 + 1] + ny * half;
    }

    // Wall segments: [0, n) inner wall, [n, 2n) outer wall; segment i joins point i and i+1.
    this.segments = new Float64Array(n * 2 * 4);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.segments.set([this.inner[i * 2], this.inner[i * 2 + 1], this.inner[j * 2], this.inner[j * 2 + 1]], i * 4);
      this.segments.set([this.outer[i * 2], this.outer[i * 2 + 1], this.outer[j * 2], this.outer[j * 2 + 1]], (n + i) * 4);
    }
    this.grid = new SegmentGrid(this.segments);

    this.startX = c[0];
    this.startY = c[1];
    this.startAngle = Math.atan2(c[3] - c[1], c[2] - c[0]);
  }

  static preset(name) {
    const points = PRESETS[name];
    if (!points) throw new Error(`Unknown track preset: ${name}`);
    return new Track(points);
  }

  static fromJSON(json) {
    return new Track(json.controlPoints, json.width);
  }

  toJSON() {
    return { controlPoints: this.controlPoints.map(([x, y]) => [x, y]), width: this.width };
  }

  /**
   * Checks that no wall segment crosses another (O(n²), run once per track).
   * Crossings between nearby indices mean a turn tighter than the track allows;
   * crossings between distant indices mean two parts of the track overlap.
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  validate() {
    if (this.controlPoints.length < MIN_CONTROL_POINTS) {
      return { ok: false, error: TRACK_ERRORS.TOO_FEW_POINTS };
    }
    const n = this.n;
    const s = this.segments;
    const total = n * 2;
    let tooClose = false;
    for (let a = 0; a < total; a++) {
      const ao = a * 4;
      for (let b = a + 1; b < total; b++) {
        const sameWall = (a < n) === (b < n);
        const gap = indexGap(a % n, b % n, n);
        if (sameWall && gap <= 1) continue; // neighbours share an endpoint
        const bo = b * 4;
        const t = segmentIntersectT(s[ao], s[ao + 1], s[ao + 2], s[ao + 3], s[bo], s[bo + 1], s[bo + 2], s[bo + 3]);
        if (t < 0) continue;
        if (gap < SHARP_TURN_WINDOW) return { ok: false, error: TRACK_ERRORS.SHARP_TURN };
        tooClose = true;
      }
    }
    // A loop narrower than the track flips the inner wall inside out without any crossing.
    if (tooClose || flatSignedArea(this.inner) <= 0) {
      return { ok: false, error: TRACK_ERRORS.SECTIONS_TOO_CLOSE };
    }
    return { ok: true };
  }

  /** Nearest centre-point index to (x, y), searching only hint ± NEAREST_SEARCH_WINDOW. */
  nearestIndex(x, y, hint) {
    const n = this.n;
    const c = this.center;
    let best = hint;
    let bestDist = Infinity;
    for (let k = -NEAREST_SEARCH_WINDOW; k <= NEAREST_SEARCH_WINDOW; k++) {
      const i = (((hint + k) % n) + n) % n;
      const dx = c[i * 2] - x;
      const dy = c[i * 2 + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /** Axis-aligned bounds of both walls: { minX, minY, maxX, maxY }. */
  bounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const wall of [this.inner, this.outer]) {
      for (let i = 0; i < wall.length; i += 2) {
        if (wall[i] < minX) minX = wall[i];
        if (wall[i] > maxX) maxX = wall[i];
        if (wall[i + 1] < minY) minY = wall[i + 1];
        if (wall[i + 1] > maxY) maxY = wall[i + 1];
      }
    }
    return { minX, minY, maxX, maxY };
  }
}

/** Shoelace signed area (positive = counter-clockwise in y-up maths coordinates). */
export function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

function flatSignedArea(flat) {
  const m = flat.length / 2;
  let sum = 0;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    sum += flat[i * 2] * flat[j * 2 + 1] - flat[j * 2] * flat[i * 2 + 1];
  }
  return sum / 2;
}

// Keeps the first point and reverses the rest, so the start position stays put.
function normalizeWinding(points) {
  if (signedArea(points) >= 0) return points;
  return [points[0], ...points.slice(1).reverse()];
}

function indexGap(i, j, n) {
  const d = Math.abs(i - j);
  return Math.min(d, n - d);
}

function unitRightNormal(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return [dy / len, -dx / len];
}

// Uniform closed Catmull-Rom spline; returns flat [x, y, ...] without repeating the first point.
function sampleCatmullRom(points, subdivisions) {
  const m = points.length;
  const out = new Float64Array(m * subdivisions * 2);
  let o = 0;
  for (let i = 0; i < m; i++) {
    const [x0, y0] = points[(i - 1 + m) % m];
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % m];
    const [x3, y3] = points[(i + 2) % m];
    for (let k = 0; k < subdivisions; k++) {
      const t = k / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      out[o++] = 0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3);
      out[o++] = 0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3);
    }
  }
  return out;
}

// Equal arc-length resampling of a closed polyline; spacing is adjusted so the loop closes evenly.
function resampleClosed(poly, spacing) {
  const m = poly.length / 2;
  const cumulative = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    cumulative[i + 1] = cumulative[i] + Math.hypot(poly[j * 2] - poly[i * 2], poly[j * 2 + 1] - poly[i * 2 + 1]);
  }
  const length = cumulative[m];
  const n = Math.max(3, Math.round(length / spacing));
  const step = length / n;
  const out = new Float64Array(n * 2);
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const target = k * step;
    while (cumulative[seg + 1] < target) seg++;
    const j = (seg + 1) % m;
    const segLen = cumulative[seg + 1] - cumulative[seg] || 1;
    const t = (target - cumulative[seg]) / segLen;
    out[k * 2] = poly[seg * 2] + (poly[j * 2] - poly[seg * 2]) * t;
    out[k * 2 + 1] = poly[seg * 2 + 1] + (poly[j * 2 + 1] - poly[seg * 2 + 1]) * t;
  }
  return out;
}
