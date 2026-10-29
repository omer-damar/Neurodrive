// Turns a hand-drawn stroke (track editor) into a Track: resample, cut the closing overlap, smooth
// out hand wobble, thin to control points, build and validate. Pure: the editor passes world-space
// points, tests pass arrays.
//
// Smoothing matters because the road is wide (TRACK_WIDTH): a wobble of a few units, or the kink
// where the loop is closed, already folds the inner wall onto itself ("turn too sharp"). The stroke
// is smoothed lightly first and more only while a sharp turn remains; overlapping road sections are
// reported as they are, since smoothing cannot fix them.
import {
  SKETCH_POINT_SPACING,
  SKETCH_SAMPLE_SPACING,
  SKETCH_SMOOTH_RADIUS,
  SKETCH_SMOOTH_PASSES,
  SKETCH_CLOSE_DISTANCE,
  MIN_CONTROL_POINTS,
  TRACK_WIDTH,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from './config.js';
import { Track, TRACK_ERRORS } from './track.js';

/**
 * Keeps the first point and then every point at least `spacing` from the last kept one. The loop is
 * closed by the spline, so a last point that lands back near the start is dropped.
 * @param {number[][]} points [[x, y], ...] in drawing order
 */
export function thinStroke(points, spacing = SKETCH_POINT_SPACING) {
  if (points.length === 0) return [];
  const kept = [points[0]];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= spacing) kept.push(point);
  }
  const first = kept[0];
  const end = kept[kept.length - 1];
  if (kept.length > 1 && Math.hypot(end[0] - first[0], end[1] - first[1]) < spacing) kept.pop();
  return kept.map(([x, y]) => [x, y]);
}

/** Points evenly spaced along the drawn polyline (pointer events arrive unevenly). */
export function resampleStroke(points, spacing = SKETCH_SAMPLE_SPACING) {
  if (points.length < 2) return points.map(([x, y]) => [x, y]);
  const out = [[points[0][0], points[0][1]]];
  let carry = 0; // distance already covered since the last output point
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    let at = spacing - carry;
    while (at <= length) {
      out.push([ax + ((bx - ax) * at) / length, ay + ((by - ay) * at) / length]);
      at += spacing;
    }
    carry = length - (at - spacing);
  }
  return out;
}

/**
 * People close a loop by drawing past the start or stopping a little short. When the stroke's last
 * quarter comes back within `distance` of the start, everything after its closest approach is cut, so
 * the spline joins the ends without a hairpin. Only the tail is searched: a figure eight also passes
 * its start halfway, and cutting there would hide the crossing.
 */
export function trimClosing(points, distance = SKETCH_CLOSE_DISTANCE) {
  const [sx, sy] = points[0] ?? [0, 0];
  let best = -1;
  let bestDistance = distance;
  for (let i = Math.floor(points.length * 0.75); i < points.length; i++) {
    const d = Math.hypot(points[i][0] - sx, points[i][1] - sy);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best < 0 ? points : points.slice(0, best + 1);
}

/** Moving average over a closed loop, repeated `passes` times; returns new points. */
export function smoothLoop(points, radius = SKETCH_SMOOTH_RADIUS, passes = 1) {
  const n = points.length;
  let current = points.map(([x, y]) => [x, y]);
  if (n < 3 || radius < 1) return current;
  const window = radius * 2 + 1;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Array(n);
    for (let i = 0; i < n; i++) {
      let x = 0;
      let y = 0;
      for (let k = -radius; k <= radius; k++) {
        const p = current[(i + k + n) % n];
        x += p[0];
        y += p[1];
      }
      next[i] = [x / window, y / window];
    }
    current = next;
  }
  return current;
}

/** Clamps a point into the world rectangle (the editor maps the canvas onto it). */
export function clampToWorld(x, y) {
  return [Math.min(WORLD_WIDTH, Math.max(0, x)), Math.min(WORLD_HEIGHT, Math.max(0, y))];
}

/**
 * @param {number[][]} points the drawn stroke in world units
 * @returns {{ ok: true, track: Track, passes: number } | { ok: false, error: string }}
 */
export function trackFromStroke(points, { spacing = SKETCH_POINT_SPACING, width = TRACK_WIDTH } = {}) {
  const loop = trimClosing(resampleStroke(points));
  let result = { ok: false, error: TRACK_ERRORS.TOO_FEW_POINTS };
  for (const passes of SKETCH_SMOOTH_PASSES) {
    const control = thinStroke(smoothLoop(loop, SKETCH_SMOOTH_RADIUS, passes), spacing);
    if (control.length < MIN_CONTROL_POINTS) return { ok: false, error: TRACK_ERRORS.TOO_FEW_POINTS };
    const track = new Track(control, width);
    const check = track.validate();
    if (check.ok) return { ok: true, track, passes };
    result = check;
    if (check.error !== TRACK_ERRORS.SHARP_TURN) break; // smoothing cannot separate overlapping sections
  }
  return result;
}

/**
 * Rebuilds a stored custom track; null when the data is malformed or the track does not validate.
 * @param {unknown} json output of Track#toJSON()
 */
export function trackFromStored(json) {
  const points = json?.controlPoints;
  const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (!Array.isArray(points) || points.length < MIN_CONTROL_POINTS || !points.every(isPoint)) return null;
  if (json.width !== undefined && !(json.width > 0)) return null;
  const track = Track.fromJSON(json);
  return track.validate().ok ? track : null;
}
