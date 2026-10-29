// The leader's sensor rays as one LineSegments plus small glowing spheres at the hit points.
// Buffers are allocated once for the ray count and rewritten in place every frame.
import * as THREE from 'three';
import { toWorld3 } from './geometry.js';

const RAY_HEIGHT = 0.25; // metres above the road
const HIT_RADIUS = 0.06;

export class SensorLines {
  constructor(rayCount) {
    this.rayCount = rayCount;
    this.group = new THREE.Group();
    this.group.name = 'sensors';

    this.positions = new Float32Array(rayCount * 2 * 3);
    this.colors = new Float32Array(rayCount * 2 * 3);
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
    this.lines = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    this.hitGeometry = new THREE.SphereGeometry(HIT_RADIUS, 10, 8);
    this.hitMaterial = new THREE.MeshBasicMaterial();
    this.hits = new THREE.InstancedMesh(this.hitGeometry, this.hitMaterial, rayCount);
    this.hits.frustumCulled = false;
    this.group.add(this.hits);

    this.color = new THREE.Color();
    this.matrix = new THREE.Matrix4();
  }

  /**
   * @param {object | null} car leader car, or null to hide
   * @param {{ x: number, y: number } | null} [pose] where the car is drawn (interpolated); the rays,
   *   cast from the current step, move with it
   */
  update(car, visible, pose = car) {
    this.group.visible = visible && car !== null && car.sensors.length === this.rayCount;
    if (!this.group.visible) return;
    const dx = pose.x - car.x;
    const dy = pose.y - car.y;
    const [cx, , cz] = toWorld3(pose.x, pose.y);
    for (let r = 0; r < this.rayCount; r++) {
      const [ex, , ez] = toWorld3(car.rayEnds[r * 2] + dx, car.rayEnds[r * 2 + 1] + dy);
      const o = r * 6;
      this.positions[o] = cx;
      this.positions[o + 1] = RAY_HEIGHT;
      this.positions[o + 2] = cz;
      this.positions[o + 3] = ex;
      this.positions[o + 4] = RAY_HEIGHT;
      this.positions[o + 5] = ez;
      // 0 (clear) -> green, 1 (touching) -> red, same as the 2D view.
      const value = car.sensors[r];
      this.color.setHSL((1 - value) / 3, 0.85, 0.55);
      this.color.toArray(this.colors, o);
      this.color.toArray(this.colors, o + 3);
      const hit = value > 0;
      this.matrix.makeTranslation(ex, RAY_HEIGHT, ez);
      if (!hit) this.matrix.makeScale(0, 0, 0);
      this.hits.setMatrixAt(r, this.matrix);
      this.hits.setColorAt(r, this.color);
    }
    this.lineGeometry.attributes.position.needsUpdate = true;
    this.lineGeometry.attributes.color.needsUpdate = true;
    this.hits.instanceMatrix.needsUpdate = true;
    if (this.hits.instanceColor) this.hits.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
    this.hitGeometry.dispose();
    this.hitMaterial.dispose();
    this.hits.dispose();
  }
}
