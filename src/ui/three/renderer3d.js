// Three.js renderer: same interface as Renderer2D (setTrack, render(scene, view), resize, dispose).
// Reads the scene, never modifies it. Loaded lazily by main.js the first time 3D is opened.
import * as THREE from 'three';
import { RAY_COUNT, POPULATION_SIZE } from '../../core/config.js';
import { createTrackGroup, disposeGroup } from './trackMesh.js';
import { CarMeshes } from './carMeshes.js';
import { SensorLines } from './sensorLines.js';
import { CameraRig } from './cameras.js';
import { loadCarTemplates, loadDecorTemplates } from './modelLibrary.js';
import { planDecor } from './decorLayout.js';
import { toWorld3 } from './geometry.js';
import { carPose } from '../interpolate.js';

const SKY_COLOR = 0x9cc7e8;
const FOG_NEAR_FACTOR = 1.5; // relative to track size
const FOG_FAR_FACTOR = 4;
const SUN = { x: 0.6, y: 1.2, z: 0.4, intensity: 2.2, shadowMapSize: 2048, shadowRadius: 12 };
const HEMI = { sky: 0xdfefff, ground: 0x3b5d3a, intensity: 1.1 };
const DECOR_FRONT_OFFSET = 0; // extra turn if the decor models' front is not their +Z side

export class Renderer3D {
  /**
   * @param {HTMLElement} container element the canvas is added to
   * @param {{ capacity?: number }} [options] capacity = largest population expected
   */
  constructor(container, options = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'canvas-3d';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 100, 400);
    this.scene.add(new THREE.HemisphereLight(HEMI.sky, HEMI.ground, HEMI.intensity));

    // The sun follows the camera target, so one modest shadow map covers what is on screen.
    this.sun = new THREE.DirectionalLight(0xffffff, SUN.intensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SUN.shadowMapSize, SUN.shadowMapSize);
    const s = this.sun.shadow.camera;
    s.left = -SUN.shadowRadius;
    s.right = SUN.shadowRadius;
    s.top = SUN.shadowRadius;
    s.bottom = -SUN.shadowRadius;
    s.near = 0.5;
    s.far = 80;
    this.scene.add(this.sun, this.sun.target);

    this.capacity = options.capacity ?? POPULATION_SIZE;
    this.cars = new CarMeshes(this.capacity); // box cars until the models arrive
    this.scene.add(this.cars.group);
    this.sensors = new SensorLines(options.rayCount ?? RAY_COUNT);
    this.scene.add(this.sensors.group);

    this.rig = new CameraRig(this.renderer.domElement);
    this.track = null;
    this.trackGroup = null;
    this.decorTemplates = null;
    this.decorGroup = new THREE.Group();
    this.decorGroup.name = 'decor';
    this.scene.add(this.decorGroup);
    this.lastTime = performance.now();
    this.leaderPose = { x: 0, y: 0, angle: 0 };
    this.resize();
  }

  /**
   * Loads the Kenney car and decor models in the background. Until then (or if they fail, e.g.
   * offline) the built-in box cars are shown and the track has no decor.
   */
  async loadModels() {
    const [cars, decor] = await Promise.all([loadCarTemplates(), loadDecorTemplates()]);
    this.carTemplates = cars;
    if (cars.length > 0) {
      this.scene.remove(this.cars.group);
      this.cars.dispose();
      this.cars = new CarMeshes(this.capacity, cars);
      this.scene.add(this.cars.group);
    }
    this.decorTemplates = decor;
    this.#buildDecor();
  }

  setTrack(track) {
    this.track = track;
    if (this.trackGroup) {
      this.scene.remove(this.trackGroup);
      disposeGroup(this.trackGroup);
    }
    const { group, bounds } = createTrackGroup(track);
    this.trackGroup = group;
    this.scene.add(group);
    this.scene.fog.near = bounds.size * FOG_NEAR_FACTOR;
    this.scene.fog.far = bounds.size * FOG_FAR_FACTOR;
    this.rig.setBounds(bounds);
    this.#buildDecor();
  }

  // Decor clones share the templates' geometry and materials, so clearing them frees nothing.
  #buildDecor() {
    this.decorGroup.clear();
    if (!this.decorTemplates || !this.track) return;
    for (const item of planDecor(this.track)) {
      const template = this.decorTemplates.get(item.kind);
      if (!template) continue;
      const obj = template.clone(true);
      const [x, , z] = toWorld3(item.x, item.y);
      obj.position.set(x, 0, z);
      // Turn the model's +Z towards the item's facing direction (world angle in the x/y plane).
      obj.rotation.y = Math.PI / 2 - item.angle + DECOR_FRONT_OFFSET;
      this.decorGroup.add(obj);
    }
  }

  /**
   * @param {{ track: object, cars: object[], leader: object | null }} scene
   * @param {{ camera?: string, showSensors?: boolean, highlightLeader?: boolean,
   *           visibleCount?: number, dimOthers?: boolean, shadows?: boolean, alpha?: number }} [view]
   *   alpha: how far the frame is between the previous and the current physics step (0..1)
   */
  render(scene, view = {}) {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (view.camera) this.rig.setMode(view.camera);
    // Turning the only shadow caster off skips the shadow pass; three recompiles the materials itself.
    this.sun.castShadow = view.shadows ?? true;
    this.cars.update(scene, view);
    const leader = view.highlightLeader === false ? null : scene.leader;
    const pose = scene.leader ? carPose(scene.leader, view.alpha ?? 1, this.leaderPose) : null;
    if (leader && leader.sensors.length !== this.sensors.rayCount) this.#rebuildSensors(leader.sensors.length);
    this.sensors.update(leader, view.showSensors ?? true, pose);
    this.rig.update(scene.leader, pose, dt);

    const focus = this.rig.mode === 'chase' && scene.leader ? this.cars.leaderObject.position : this.rig.look;
    this.sun.target.position.copy(focus);
    this.sun.position.set(focus.x + SUN.x * 20, SUN.y * 20, focus.z + SUN.z * 20);

    this.renderer.render(this.scene, this.rig.camera);
  }

  // A new training may use another ray count (settings panel); the line buffers are sized per count.
  #rebuildSensors(rayCount) {
    this.scene.remove(this.sensors.group);
    this.sensors.dispose();
    this.sensors = new SensorLines(rayCount);
    this.scene.add(this.sensors.group);
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return; // hidden: resize again when shown
    this.renderer.setSize(width, height, false);
    this.rig.resize(width, height);
  }

  dispose() {
    if (this.trackGroup) disposeGroup(this.trackGroup);
    this.decorGroup.clear();
    for (const template of this.decorTemplates?.values() ?? []) disposeGroup(template);
    for (const template of this.carTemplates ?? []) disposeGroup(template.root);
    this.cars.dispose();
    this.sensors.dispose();
    this.rig.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
