// Loads the car and decor GLB models (assets/models, licences in LICENSE.md) and normalizes them:
// cars face +X, are scaled to CAR_LENGTH and sit on the ground at the origin; decor is scaled by
// DECOR_SCALE and centred on its footprint. A model that fails to load is skipped; callers keep their box fallback.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAR_LENGTH, SCALE } from '../../core/config.js';
import { DECOR_KINDS, DECOR_SCALE } from './decorLayout.js';

const CAR_DIR = 'assets/models/cars/';
const DECOR_DIR = 'assets/models/decor/';
export const CAR_MODELS = Object.freeze([
  'race',
  'raceCarRed',
  'sedan-sports',
  'raceCarGreen',
  'race-future',
  'raceCarOrange',
  'hatchback-sports',
  'raceCarWhite',
  'rx7',
  'charger',
  'muscle-car',
  'convertible',
  'camaro',
  'aventador',
]);
// Front wheels found by name: Kenney ("wheel-front-left", "wheelFrontLeft"), RX-7 ("FL_WHEEL"),
// Aventador ("..._Wheel_FL"). Models with other names list them in CAR_MODEL_OPTIONS.
const FRONT_WHEEL = /wheel[-_]?front|^f[lr][-_]?wheel$|wheel[-_]f[lr]$/i;
// Direction of the model's front in its own x/z plane, as atan2(z, x). Turning the model by this
// angle about Y maps its front onto +X (our forward). Most models face +Z.
const DEFAULT_FORWARD_ANGLE = Math.PI / 2;
// Per-model exceptions, checked by eye in a model viewer. Models without separate front wheels
// (convertible, camaro) simply do not steer.
const CAR_MODEL_OPTIONS = Object.freeze({
  charger: { frontWheels: ['Circle002', 'Circle003'] },
  'muscle-car': { forwardAngle: Math.PI, frontWheels: ['Cylinder001', 'Cylinder003'] },
  camaro: { forwardAngle: (-23.2 * Math.PI) / 180 }, // authored at an angle; from its tightest bounding box
});

/**
 * @returns {Promise<{ name: string, root: THREE.Object3D, frontWheelNames: string[] }[]>}
 */
export async function loadCarTemplates(names = CAR_MODELS) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(names.map((name) => loader.loadAsync(`${CAR_DIR}${name}.glb`)));
  const templates = [];
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.warn(`Car model ${names[i]} failed to load`, result.reason);
      return;
    }
    const model = result.value.scene;
    const options = CAR_MODEL_OPTIONS[names[i]] ?? {};
    const wheels = new Set();
    model.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = true;
      const listed = options.frontWheels ? options.frontWheels.includes(obj.name) : FRONT_WHEEL.test(obj.name);
      if (listed) wheels.add(obj);
    });
    // Keep only the outermost match: Racing Kit wheels are groups whose meshes match too,
    // and turning both would steer twice.
    const frontWheelNames = [...wheels].filter((obj) => !hasAncestorIn(obj, wheels)).map((obj) => obj.name);
    const rotationY = options.forwardAngle ?? DEFAULT_FORWARD_ANGLE;
    templates.push({ name: names[i], root: normalize(model, { length: CAR_LENGTH * SCALE, rotationY }), frontWheelNames });
  });
  return templates;
}

/** @returns {Promise<Map<string, THREE.Object3D>>} decor kind -> normalized template */
export async function loadDecorTemplates(kinds = Object.keys(DECOR_KINDS)) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(kinds.map((kind) => loader.loadAsync(`${DECOR_DIR}${kind}.glb`)));
  const templates = new Map();
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') {
      console.warn(`Decor model ${kinds[i]} failed to load`, result.reason);
      return;
    }
    const model = result.value.scene;
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    templates.set(kinds[i], normalize(model, { scale: DECOR_SCALE }));
  });
  return templates;
}

function hasAncestorIn(obj, set) {
  for (let p = obj.parent; p; p = p.parent) if (set.has(p)) return true;
  return false;
}

/**
 * Wraps the model so the wrapper's origin is at the footprint centre on the ground.
 * Either `length` (fit the forward extent after rotation) or a fixed `scale` is applied.
 * Boxes are measured on the vertices (precise): the default rotates each mesh's bounding box,
 * which overestimates turned models (the camaro) and rotated wheel nodes (the muscle car).
 */
function normalize(model, { length = null, scale = 1, rotationY = 0 }) {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  model.rotation.y = rotationY;
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(length ? length / size.x : scale);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model, true);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}
