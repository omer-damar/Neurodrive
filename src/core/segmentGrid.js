// Uniform spatial grid over wall segments, so collision and ray tests only look at nearby walls.
import { GRID_CELL_SIZE } from './config.js';

export class SegmentGrid {
  /**
   * @param {Float64Array} segments flat [ax, ay, bx, by, ...]
   * @param {number} [cellSize]
   */
  constructor(segments, cellSize = GRID_CELL_SIZE) {
    this.segments = segments;
    this.cellSize = cellSize;
    const count = segments.length / 4;
    this.count = count;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < segments.length; i += 2) {
      const x = segments[i];
      const y = segments[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.minX = minX;
    this.minY = minY;
    this.cols = Math.max(1, Math.floor((maxX - minX) / cellSize) + 1);
    this.rows = Math.max(1, Math.floor((maxY - minY) / cellSize) + 1);

    // Two passes into a compressed layout: cellStart[c]..cellStart[c+1] indexes cellItems.
    const cellCount = this.cols * this.rows;
    const counts = new Uint32Array(cellCount + 1);
    this.#forEachCell((cell) => {
      counts[cell + 1]++;
    });
    for (let c = 0; c < cellCount; c++) counts[c + 1] += counts[c];
    this.cellStart = counts;
    this.cellItems = new Uint32Array(counts[cellCount]);
    const fill = counts.slice(0, cellCount);
    this.#forEachCell((cell, seg) => {
      this.cellItems[fill[cell]++] = seg;
    });

    // Query scratch: stamps dedupe segments that span several cells; result is reused.
    this.stamps = new Uint32Array(count);
    this.stamp = 0;
    this.result = new Uint32Array(count);
  }

  #forEachCell(visit) {
    const s = this.segments;
    for (let seg = 0; seg < this.count; seg++) {
      const o = seg * 4;
      const c0 = this.#col(Math.min(s[o], s[o + 2]));
      const c1 = this.#col(Math.max(s[o], s[o + 2]));
      const r0 = this.#row(Math.min(s[o + 1], s[o + 3]));
      const r1 = this.#row(Math.max(s[o + 1], s[o + 3]));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) visit(r * this.cols + c, seg);
      }
    }
  }

  #col(x) {
    const c = Math.floor((x - this.minX) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  #row(y) {
    const r = Math.floor((y - this.minY) / this.cellSize);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }

  /**
   * Candidate segments whose cells touch the box. Indices are written to `this.result`;
   * the return value is how many are valid. The buffer is overwritten by the next query.
   */
  queryBox(x0, y0, x1, y1) {
    if (++this.stamp === 0xffffffff) {
      this.stamps.fill(0);
      this.stamp = 1;
    }
    const stamp = this.stamp;
    const c0 = this.#col(Math.min(x0, x1));
    const c1 = this.#col(Math.max(x0, x1));
    const r0 = this.#row(Math.min(y0, y1));
    const r1 = this.#row(Math.max(y0, y1));
    let found = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = r * this.cols + c;
        for (let k = this.cellStart[cell]; k < this.cellStart[cell + 1]; k++) {
          const seg = this.cellItems[k];
          if (this.stamps[seg] === stamp) continue;
          this.stamps[seg] = stamp;
          this.result[found++] = seg;
        }
      }
    }
    return found;
  }
}
