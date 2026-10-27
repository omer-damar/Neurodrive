// Chase / top / orbit cameras over one PerspectiveCamera. Chase and top glide towards their target
// with frame-rate-independent smoothing, so a leader change is a smooth move, not a jump.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toWorld3, toRotationY } from './geometry.js';

export const CAMERA_MODES = Object.freeze(['chase', 'top', 'orbit']);

const FOV = 55;
const NEAR = 0.1;
const FAR = 500;
const CHASE = { back: 3.2, up: 1.6, lookAhead: 2.5, lookUp: 0.3 };
const TOP = { heightFactor: 1.05, tiltFactor: 0.35 }; // relative to track size
const SMOOTHING_PER_SECOND = 4; // larger = snappier
const ORBIT_START = { height: 0.75, distance: 0.95 }; // relative to track size

export class CameraRig {
  /** @param {HTMLElement} domElement element that receives orbit mouse input */
  constructor(domElement) {
    this.camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // stay above the ground
    this.controls.enabled = false;
    this.mode = 'chase';
    this.bounds = { cx: 0, cz: 0, size: 50 };
    this.targetPos = new THREE.Vector3();
    this.targetLook = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.snapNext = true;
  }

  setBounds(bounds) {
    this.bounds = bounds;
    this.camera.far = Math.max(FAR, bounds.size * 6);
    this.camera.updateProjectionMatrix();
    if (this.mode === 'orbit') this.#resetOrbit();
    this.snapNext = true;
  }

  setMode(mode) {
    if (!CAMERA_MODES.includes(mode) || mode === this.mode) return;
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') this.#resetOrbit();
    this.snapNext = mode === 'top';
  }

  resize(width, height) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** @param {object | null} leader @param {number} dtSeconds real time since last frame */
  update(leader, dtSeconds) {
    if (this.mode === 'orbit') {
      this.controls.update();
      return;
    }
    const b = this.bounds;
    if (this.mode === 'top' || !leader) {
      this.targetPos.set(b.cx, b.size * TOP.heightFactor, b.cz + b.size * TOP.tiltFactor);
      this.targetLook.set(b.cx, 0, b.cz);
    } else {
      const [x, , z] = toWorld3(leader.x, leader.y);
      const ry = toRotationY(leader.angle);
      const fx = Math.cos(ry);
      const fz = -Math.sin(ry); // forward direction in three.js
      this.targetPos.set(x - fx * CHASE.back, CHASE.up, z - fz * CHASE.back);
      this.targetLook.set(x + fx * CHASE.lookAhead, CHASE.lookUp, z + fz * CHASE.lookAhead);
    }
    // Exponential smoothing: the same feel at 30, 60 or 144 Hz.
    const t = this.snapNext ? 1 : 1 - Math.exp(-SMOOTHING_PER_SECOND * Math.min(dtSeconds, 0.1));
    this.snapNext = false;
    this.camera.position.lerp(this.targetPos, t);
    this.look.lerp(this.targetLook, t);
    this.camera.lookAt(this.look);
  }

  dispose() {
    this.controls.dispose();
  }

  #resetOrbit() {
    const b = this.bounds;
    this.controls.target.set(b.cx, 0, b.cz);
    this.camera.position.set(b.cx, b.size * ORBIT_START.height, b.cz + b.size * ORBIT_START.distance);
    this.controls.update();
  }
}
