// Cars in 3D. Each car type (a loaded Kenney model, or the built-in box car as fallback) is split
// into its mesh parts, and every part becomes one InstancedMesh, so the whole population costs a
// few draw calls. Car i uses type i % typeCount. The leader is drawn separately as a full clone with
// steering front wheels and body roll. Matrices and colours are rewritten in place every frame.
import * as THREE from 'three';
import { CAR_LENGTH, CAR_WIDTH, SCALE, MAX_SPEED } from '../../core/config.js';
import { toWorld3, toRotationY } from './geometry.js';

const L = CAR_LENGTH * SCALE; // 1.1 m
const W = CAR_WIDTH * SCALE; // 0.55 m
const WHEEL_STEER_ANGLE = 0.45; // radians at full steer
const MAX_ROLL = 0.08; // radians of body lean at full steer and top speed

// Instance tints multiply the model's own colours: white keeps them as authored.
const TINTS = {
  alive: new THREE.Color(1, 1, 1),
  dead: new THREE.Color(0.32, 0.33, 0.36),
  finished: new THREE.Color(1, 0.85, 0.35),
  dimFactor: 0.35,
};

export class CarMeshes {
  /**
   * @param {number} capacity maximum population size
   * @param {{ name: string, root: THREE.Object3D, frontWheelNames: string[] }[] | null} [templates]
   *   normalized car models (forward +X, length L, on the ground); null uses the box car
   */
  constructor(capacity, templates = null) {
    this.group = new THREE.Group();
    this.group.name = 'cars';
    this.ownsTemplates = !templates || templates.length === 0;
    const list = this.ownsTemplates ? [createBoxTemplate()] : templates;
    this.types = list.map((template) => createCarType(template, capacity));
    for (const type of this.types) for (const part of type.parts) this.group.add(part.mesh);

    // Leader: one full clone per type, created on first use; only the current one is visible.
    this.leaders = new Map();
    this.leaderPivot = new THREE.Group(); // positioned and turned like the car
    this.leaderRoll = new THREE.Group(); // leans in corners
    this.leaderPivot.add(this.leaderRoll);
    this.group.add(this.leaderPivot);
    this.leaderClone = null;

    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.one = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.color = new THREE.Color();
    this.counts = new Uint32Array(this.types.length);
    this.drawList = [];
    this.visible = new Set();
  }

  /** The leader's root object (its position drives the shadow focus). */
  get leaderObject() {
    return this.leaderPivot;
  }

  /**
   * @param {{ cars: object[], leader: object | null }} scene
   * @param {{ visibleCount?: number, dimOthers?: boolean, highlightLeader?: boolean }} view
   */
  update(scene, view) {
    const cars = scene.cars;
    const leader = view.highlightLeader === false ? null : scene.leader;
    const visible = this.#visibleSet(cars, view.visibleCount ?? Infinity);
    const dim = view.dimOthers === true;
    const typeCount = this.types.length;
    this.counts.fill(0);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car === leader || (visible !== null && !visible.has(car))) continue;
      const type = this.types[i % typeCount];
      const slot = this.counts[i % typeCount]++;
      if (slot >= type.capacity) continue;
      this.#composeCar(car);
      this.color.copy(car.finished ? TINTS.finished : car.alive ? TINTS.alive : TINTS.dead);
      if (dim) this.color.multiplyScalar(TINTS.dimFactor);
      for (const part of type.parts) {
        part.mesh.setMatrixAt(slot, this.matrix);
        part.mesh.setColorAt(slot, this.color);
      }
    }
    this.types.forEach((type, t) => {
      for (const part of type.parts) {
        part.mesh.count = Math.min(this.counts[t], type.capacity);
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    });

    this.leaderPivot.visible = leader !== null;
    if (leader) this.#placeLeader(leader, cars.indexOf(leader) % typeCount);
  }

  dispose() {
    for (const type of this.types) {
      for (const part of type.parts) {
        part.geometry.dispose();
        part.mesh.dispose();
      }
    }
    // Leader clones share geometry and materials with their templates; the templates' owner
    // (the model library, or this class for the box car) frees those.
    if (this.ownsTemplates) disposeObject(this.types[0].template.root);
  }

  #composeCar(car) {
    const [x, , z] = toWorld3(car.x, car.y);
    this.position.set(x, 0, z);
    this.quaternion.setFromAxisAngle(this.up, toRotationY(car.angle));
    this.matrix.compose(this.position, this.quaternion, this.one);
  }

  // null means "all cars"; otherwise the N furthest-progressed cars. Reuses one array and set.
  #visibleSet(cars, limit) {
    if (limit >= cars.length) return null;
    const list = this.drawList;
    list.length = 0;
    for (const car of cars) list.push(car);
    list.sort((a, b) => b.maxProgress - a.maxProgress);
    list.length = limit;
    this.visible.clear();
    for (const car of list) this.visible.add(car);
    return this.visible;
  }

  #placeLeader(car, typeIndex) {
    let entry = this.leaders.get(typeIndex);
    if (!entry) {
      entry = createLeader(this.types[typeIndex].template);
      this.leaders.set(typeIndex, entry);
    }
    if (this.leaderClone !== entry.root) {
      if (this.leaderClone) this.leaderRoll.remove(this.leaderClone);
      this.leaderRoll.add(entry.root);
      this.leaderClone = entry.root;
    }
    const [x, , z] = toWorld3(car.x, car.y);
    this.leaderPivot.position.set(x, 0, z);
    this.leaderPivot.rotation.y = toRotationY(car.angle);
    // Lean away from the turn, more at speed (roll about the forward X axis).
    this.leaderRoll.rotation.x = -car.steer * (car.speed / MAX_SPEED) * MAX_ROLL;
    entry.pivots.forEach((pivot, k) => {
      pivot.quaternion.setFromAxisAngle(entry.axes[k], -car.steer * WHEEL_STEER_ANGLE);
    });
  }
}

// Full clone of a car type for the leader. Each front wheel is moved into a pivot at the wheel's
// centre, and steering turns the pivot about the car's up axis in the parent's space. This works
// whether a model keeps its wheels in tilted frames (RX-7) or bakes them around the car origin (Charger).
function createLeader(template) {
  const root = template.root.clone(true);
  root.updateMatrixWorld(true);
  const wheels = template.frontWheelNames.map((name) => root.getObjectByName(name)).filter(Boolean);
  const parentQuaternion = new THREE.Quaternion();
  const box = new THREE.Box3();
  const pivots = [];
  const axes = [];
  for (const wheel of wheels) {
    const parent = wheel.parent;
    const centre = parent.worldToLocal(box.setFromObject(wheel).getCenter(new THREE.Vector3()));
    const pivot = new THREE.Group();
    pivot.position.copy(centre);
    parent.add(pivot);
    pivot.add(wheel);
    wheel.position.sub(centre);
    parent.getWorldQuaternion(parentQuaternion);
    axes.push(new THREE.Vector3(0, 1, 0).applyQuaternion(parentQuaternion.invert()).normalize());
    pivots.push(pivot);
  }
  return { root, pivots, axes };
}

// Bakes every mesh of the template into its own InstancedMesh (geometry in template space).
function createCarType(template, capacity) {
  template.root.updateMatrixWorld(true);
  const parts = [];
  template.root.traverse((obj) => {
    if (!obj.isMesh) return;
    const geometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
    const mesh = new THREE.InstancedMesh(geometry, obj.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // instances spread over the whole track
    mesh.count = 0;
    parts.push({ geometry, mesh });
  });
  return { template, parts, capacity };
}

// Built-in low-poly car used when the GLB models are unavailable (offline, blocked, failed).
function createBoxTemplate() {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x4fd1a5, roughness: 0.4, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.1, metalness: 0.5 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.9 });
  const add = (geometry, material, x, y, z, name = '') => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.name = name;
    mesh.castShadow = true;
    root.add(mesh);
    return mesh;
  };
  const wheelR = 0.13;
  const bodyH = 0.22;
  const ride = wheelR * 0.6;
  add(new THREE.BoxGeometry(L, bodyH, W), paint, 0, ride + bodyH / 2, 0);
  add(new THREE.BoxGeometry(L * 0.45, 0.18, W * 0.84), glass, -0.06 * L, ride + bodyH + 0.09, 0);
  const wheel = new THREE.CylinderGeometry(wheelR, wheelR, 0.1, 14);
  wheel.rotateX(Math.PI / 2);
  for (const [x, front] of [[0.32 * L, true], [-0.32 * L, false]]) {
    for (const side of [-1, 1]) {
      add(wheel, tyre, x, wheelR, side * W / 2, front ? `wheel-front-${side}` : '');
    }
  }
  return { name: 'box', root, frontWheelNames: ['wheel-front--1', 'wheel-front-1'] };
}

function disposeObject(root) {
  const seen = new Set();
  root.traverse((obj) => {
    if (obj.geometry && !seen.has(obj.geometry)) {
      seen.add(obj.geometry);
      obj.geometry.dispose();
    }
    if (obj.material && !seen.has(obj.material)) {
      seen.add(obj.material);
      obj.material.dispose();
    }
  });
}
