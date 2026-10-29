// Chase / top / orbit cameras over one PerspectiveCamera. The chase camera is fixed behind the
// (interpolated) car, so it neither shakes nor falls back at speed; only its heading swings round
// smoothly in corners, and a new leader is reached with a short blend instead of a jump. The top
// camera glides towards its target with frame-rate-independent smoothing.
// The top camera zooms with the mouse wheel towards the point under the cursor.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toWorld3, toRotationY, zoomTopCamera } from './geometry.js';

export const CAMERA_MODES = Object.freeze(['chase', 'top', 'orbit']);

const FOV = 55;
const NEAR = 0.1;
const FAR = 500;
const CHASE = { back: 4.2, up: 2, lookAhead: 2.5, lookUp: 0.3 };
const TOP = { heightFactor: 1.05, tiltFactor: 0.35 }; // relative to track size
const SMOOTHING_PER_SECOND = 4; // top camera glide; larger = snappier
const CHASE_YAW_SMOOTHING = 8; // per second: how fast the chase camera swings round behind the car
const LEADER_BLEND_SECONDS = 0.6; // chase camera move to a new leader (or from another mode)
const ORBIT_START = { height: 0.75, distance: 0.95 }; // relative to track size
// Wheel zoom of the top camera: distance factor range and how fast one wheel unit zooms.
const TOP_ZOOM = Object.freeze({ min: 0.15, max: 1, speed: 0.0015 });

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
    this.followed = null; // car the chase camera is fixed behind
    this.chaseYaw = 0;
    this.blend = 1; // 0..1 progress of the move to a new leader; 1 = attached
    this.fromPos = new THREE.Vector3();
    this.fromLook = new THREE.Vector3();

    this.domElement = domElement;
    this.topView = { zoom: TOP_ZOOM.max, x: 0, z: 0 };
    this.raycaster = new THREE.Raycaster();
    this.aimCamera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR); // where the top camera is heading
    this.pointer = new THREE.Vector2();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.onWheel = (event) => this.#zoomTop(event);
    // Not passive: in top view the wheel zooms instead of scrolling the page.
    domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  setBounds(bounds) {
    this.bounds = bounds;
    this.topView = { zoom: TOP_ZOOM.max, x: bounds.cx, z: bounds.cz };
    this.camera.far = Math.max(FAR, bounds.size * 6);
    this.camera.updateProjectionMatrix();
    if (this.mode === 'orbit') this.#resetOrbit();
    this.snapNext = true;
    this.followed = null; // the chase camera jumps to the new track instead of blending
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

  /**
   * @param {object | null} leader car to follow
   * @param {{ x: number, y: number, angle: number } | null} pose where the leader is drawn (interpolated)
   * @param {number} dtSeconds real time since last frame
   */
  update(leader, pose, dtSeconds) {
    if (this.mode === 'orbit') {
      this.controls.update();
      return;
    }
    const dt = Math.min(dtSeconds, 0.1);
    if (this.mode === 'chase' && leader) {
      this.#chase(leader, pose, dt);
      return;
    }
    this.followed = null; // coming back to chase blends in from here
    const b = this.bounds;
    if (this.mode === 'top') {
      this.#topPose(this.topView, this.targetPos, this.targetLook);
    } else {
      this.targetPos.set(b.cx, b.size * TOP.heightFactor, b.cz + b.size * TOP.tiltFactor);
      this.targetLook.set(b.cx, 0, b.cz);
    }
    // Exponential smoothing: the same feel at 30, 60 or 144 Hz.
    const t = this.snapNext ? 1 : 1 - Math.exp(-SMOOTHING_PER_SECOND * dt);
    this.snapNext = false;
    this.camera.position.lerp(this.targetPos, t);
    this.look.lerp(this.targetLook, t);
    this.camera.lookAt(this.look);
  }

  #chase(leader, pose, dt) {
    const ry = toRotationY(pose.angle);
    if (this.followed !== leader) {
      // New leader or just switched to chase: blend over from where the camera is (or jump on a new track).
      this.followed = leader;
      this.chaseYaw = ry;
      this.blend = this.snapNext ? 1 : 0;
      this.fromPos.copy(this.camera.position);
      this.fromLook.copy(this.look);
    } else {
      const diff = Math.atan2(Math.sin(ry - this.chaseYaw), Math.cos(ry - this.chaseYaw));
      this.chaseYaw += diff * (1 - Math.exp(-CHASE_YAW_SMOOTHING * dt));
    }
    this.snapNext = false;
    const [x, , z] = toWorld3(pose.x, pose.y);
    const fx = Math.cos(this.chaseYaw);
    const fz = -Math.sin(this.chaseYaw); // forward direction in three.js
    this.targetPos.set(x - fx * CHASE.back, CHASE.up, z - fz * CHASE.back);
    this.targetLook.set(x + fx * CHASE.lookAhead, CHASE.lookUp, z + fz * CHASE.lookAhead);
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / LEADER_BLEND_SECONDS);
      const e = this.blend * this.blend * (3 - 2 * this.blend); // smoothstep
      this.camera.position.lerpVectors(this.fromPos, this.targetPos, e);
      this.look.lerpVectors(this.fromLook, this.targetLook, e);
    } else {
      this.camera.position.copy(this.targetPos);
      this.look.copy(this.targetLook);
    }
    this.camera.lookAt(this.look);
  }

  dispose() {
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.controls.dispose();
  }

  #zoomTop(event) {
    if (this.mode !== 'top') return; // orbit has its own wheel zoom; chase lets the page scroll
    event.preventDefault();
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    // Aim from the pose the camera glides to, not from where it is mid-glide: fast wheel turns
    // then keep the same ground point under the cursor.
    const aim = this.aimCamera;
    aim.aspect = this.camera.aspect;
    aim.updateProjectionMatrix();
    this.#topPose(this.topView, aim.position, this.hit);
    aim.lookAt(this.hit);
    aim.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, aim);
    const point = this.raycaster.ray.intersectPlane(this.ground, this.hit) ?? { x: this.topView.x, z: this.topView.z };
    // Line-mode wheels (Firefox) report a few lines per notch; scale them to about pixels.
    const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
    this.topView = zoomTopCamera(this.topView, point, delta, this.bounds, TOP_ZOOM);
  }

  // Camera position and look-at point of the top view for a zoom and focus.
  #topPose({ zoom, x, z }, position, look) {
    const size = this.bounds.size;
    position.set(x, size * TOP.heightFactor * zoom, z + size * TOP.tiltFactor * zoom);
    look.set(x, 0, z);
  }

  #resetOrbit() {
    const b = this.bounds;
    this.controls.target.set(b.cx, 0, b.cz);
    this.camera.position.set(b.cx, b.size * ORBIT_START.height, b.cz + b.size * ORBIT_START.distance);
    this.controls.update();
  }
}
