// Loads the Kenney GLB models (assets/models, CC0) and normalizes them: cars face +X, are scaled to
// CAR_LENGTH and sit on the ground at the origin; decor is scaled by DECOR_SCALE and centred on its
// footprint. A model that fails to load is skipped; callers keep their box fallback.
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
]);
const FRONT_WHEEL = /wheel[-_]?front/i;
// Kenney models face +Z; a quarter turn about Y maps +Z onto +X (our forward).
const MODEL_TO_FORWARD_X = Math.PI / 2;

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
    const frontWheelNames = [];
    model.traverse((obj) => {
      if (obj.isMesh) obj.castShadow = true;
      if (FRONT_WHEEL.test(obj.name)) frontWheelNames.push(obj.name);
    });
    templates.push({ name: names[i], root: normalize(model, { length: CAR_LENGTH * SCALE, rotationY: MODEL_TO_FORWARD_X }), frontWheelNames });
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

/**
 * Wraps the model so the wrapper's origin is at the footprint centre on the ground.
 * Either `length` (fit the forward extent after rotation) or a fixed `scale` is applied.
 */
function normalize(model, { length = null, scale = 1, rotationY = 0 }) {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  model.rotation.y = rotationY;
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(length ? length / size.x : scale);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}
