// Pure decor layout: where grandstands, tents, flags, billboards, lights and trees go around a track.
// No three.js import, so it is tested in Node. Positions are in 2D world units; the 3D side only
// turns them into model instances. Decor never touches the simulation.
import { mulberry32 } from '../../core/math.js';
import { SCALE } from '../../core/config.js';

export const DECOR_SCALE = 4; // metres per Kenney kit unit (a kit road tile ≈ our 4 m road width)
const KIT_UNIT = DECOR_SCALE / SCALE; // world units per kit unit

// Footprint (width × depth in kit units, measured from the GLB bounds) of every decor kind.
export const DECOR_KINDS = Object.freeze({
  grandStand: { w: 1, d: 1 },
  grandStandCovered: { w: 1, d: 1 },
  tent: { w: 1, d: 1 },
  tentLong: { w: 2, d: 1 },
  treeLarge: { w: 0.36, d: 0.42 },
  treeSmall: { w: 0.26, d: 0.3 },
  flagCheckers: { w: 0.2, d: 0.05 },
  flagRed: { w: 0.2, d: 0.05 },
  flagGreen: { w: 0.2, d: 0.05 },
  billboard: { w: 1, d: 0.5 },
  lightPostLarge: { w: 0.38, d: 0.1 },
  bannerTowerRed: { w: 0.4, d: 0.4 },
});

const ROAD_CLEARANCE = 25; // world units between the road edge and any decor footprint
const ITEM_GAP = 10; // world units between two decor footprints
const GRANDSTANDS = ['grandStandCovered', 'grandStand', 'grandStand'];
const GRANDSTAND_MIN_SPACING = 0.2; // fraction of the lap between grandstands
const STRAIGHTNESS_WINDOW = 6; // indices either side used to measure how straight a section is
const SIDE_PROPS = ['billboard', 'lightPostLarge', 'flagRed', 'flagGreen'];
const SIDE_PROP_EVERY = 0.09; // fraction of the lap between roadside props
const TREE_COUNT = 60;
const TREE_ATTEMPTS = 3000;
const TREE_AREA_MARGIN = 6; // kit units of ground around the track bounds where trees may grow

/** Bounding radius of a decor kind in world units. */
export function decorRadius(kind) {
  const { w, d } = DECOR_KINDS[kind];
  return (Math.hypot(w, d) / 2) * KIT_UNIT;
}

/**
 * @param {import('../../core/track.js').Track} track
 * @param {number} [seed]
 * @returns {{ kind: string, x: number, y: number, angle: number }[]} angle: direction the item's
 *   front faces in world space (towards the road for stands and props, random for trees)
 */
export function planDecor(track, seed = 7) {
  const rng = mulberry32(seed);
  const items = [];
  const n = track.n;
  const half = track.width / 2;

  const tryPlace = (kind, x, y, angle) => {
    const r = decorRadius(kind);
    if (distanceToCentreLine(track, x, y) < half + ROAD_CLEARANCE + r) return false;
    for (const other of items) {
      if (Math.hypot(other.x - x, other.y - y) < r + decorRadius(other.kind) + ITEM_GAP) return false;
    }
    items.push({ kind, x, y, angle });
    return true;
  };

  // Facing the road from the outside: front points back along the inward normal.
  const besideRoad = (kind, i, extra = 0) => {
    const nx = track.normals[i * 2];
    const ny = track.normals[i * 2 + 1];
    const dist = half + ROAD_CLEARANCE + decorRadius(kind) + extra;
    const x = track.center[i * 2] + nx * dist;
    const y = track.center[i * 2 + 1] + ny * dist;
    return tryPlace(kind, x, y, Math.atan2(-ny, -nx));
  };

  // Start line: chequered flags on both sides, a banner tower behind the outer one.
  for (const side of [1, -1]) {
    const nx = track.normals[0] * side;
    const ny = track.normals[1] * side;
    const dist = half + ROAD_CLEARANCE * 0.6;
    items.push({ kind: 'flagCheckers', x: track.center[0] + nx * dist, y: track.center[1] + ny * dist, angle: Math.atan2(-ny, -nx) });
  }
  besideRoad('bannerTowerRed', (n - 4) % n);

  // Grandstands on the straightest outer sections, spread around the lap.
  const byStraightness = Array.from({ length: n }, (_, i) => i).sort((a, b) => turnAt(track, a) - turnAt(track, b));
  const stands = [];
  for (const i of byStraightness) {
    if (stands.length === GRANDSTANDS.length) break;
    if (stands.some((j) => indexGap(i, j, n) < n * GRANDSTAND_MIN_SPACING)) continue;
    if (besideRoad(GRANDSTANDS[stands.length], i)) stands.push(i);
  }

  // Paddock tents just before the start line.
  besideRoad('tentLong', (n - Math.round(n * 0.06)) % n, 40);
  besideRoad('tent', (n - Math.round(n * 0.11)) % n, 40);

  // Billboards, lights and flags along the outside of the lap.
  const step = Math.max(1, Math.round(n * SIDE_PROP_EVERY));
  for (let i = Math.round(step / 2), k = 0; i < n; i += step, k++) {
    besideRoad(SIDE_PROPS[k % SIDE_PROPS.length], i);
  }

  // Trees scattered over the remaining ground, inside and outside the loop.
  const b = track.bounds();
  const margin = TREE_AREA_MARGIN * KIT_UNIT;
  let trees = 0;
  for (let a = 0; a < TREE_ATTEMPTS && trees < TREE_COUNT; a++) {
    const x = b.minX - margin + rng() * (b.maxX - b.minX + margin * 2);
    const y = b.minY - margin + rng() * (b.maxY - b.minY + margin * 2);
    const kind = rng() < 0.6 ? 'treeLarge' : 'treeSmall';
    if (tryPlace(kind, x, y, rng() * Math.PI * 2)) trees++;
  }
  return items;
}

/** Shortest distance from (x, y) to the centre line polyline. */
export function distanceToCentreLine(track, x, y) {
  const c = track.center;
  const n = track.n;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = c[i * 2];
    const ay = c[i * 2 + 1];
    const dx = c[j * 2] - ax;
    const dy = c[j * 2 + 1] - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) best = d;
  }
  return best;
}

// Total absolute heading change over a window around index i (radians): 0 on a straight.
function turnAt(track, i) {
  const n = track.n;
  const c = track.center;
  let total = 0;
  for (let k = -STRAIGHTNESS_WINDOW; k < STRAIGHTNESS_WINDOW; k++) {
    const a = (((i + k) % n) + n) % n;
    const b = (a + 1) % n;
    const d = (b + 1) % n;
    const h1 = Math.atan2(c[b * 2 + 1] - c[a * 2 + 1], c[b * 2] - c[a * 2]);
    const h2 = Math.atan2(c[d * 2 + 1] - c[b * 2 + 1], c[d * 2] - c[b * 2]);
    total += Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
  }
  return total;
}

function indexGap(i, j, n) {
  const d = Math.abs(i - j);
  return Math.min(d, n - d);
}
