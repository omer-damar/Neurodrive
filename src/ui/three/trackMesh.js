// Ground, road, barriers and start line meshes for one track. Rebuilt (and the old one disposed)
// whenever the track changes.
import * as THREE from 'three';
import { BARRIER_HEIGHT } from '../../core/config.js';
import { buildRoadStrip, buildBarrier, buildStartLine, trackBounds3 } from './geometry.js';

const GROUND_COLOR = 0x2f5a35;
const GROUND_MARGIN = 3; // ground plane size as a multiple of the track size
const ASPHALT_COLOR = '#2b3038';
const LANE_COLOR = '#e8e8e8';
const DASH_PERIOD_M = 3; // one dash + gap along the road, metres
const LANE_TEXTURE_SIZE = 64;

export function createTrackGroup(track) {
  const group = new THREE.Group();
  group.name = 'track';
  const bounds = trackBounds3(track);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.size * GROUND_MARGIN, bounds.size * GROUND_MARGIN),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(bounds.cx, -0.01, bounds.cz);
  ground.receiveShadow = true;
  group.add(ground);

  const road = buildRoadStrip(track);
  const roadGeometry = indexedGeometry(road.positions, road.indices);
  roadGeometry.setAttribute('uv', new THREE.BufferAttribute(road.uvs, 2));
  const laneTexture = createLaneTexture();
  laneTexture.repeat.set(1, 1 / DASH_PERIOD_M);
  const roadMesh = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({ map: laneTexture, roughness: 0.9 }),
  );
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  for (const wall of [track.inner, track.outer]) {
    const barrier = buildBarrier(wall, BARRIER_HEIGHT);
    const geometry = indexedGeometry(barrier.positions, barrier.indices);
    geometry.setAttribute('color', new THREE.BufferAttribute(barrier.colors, 3));
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const start = buildStartLine(track);
  const startGeometry = indexedGeometry(start.positions, start.indices);
  startGeometry.setAttribute('color', new THREE.BufferAttribute(start.colors, 3));
  const startMesh = new THREE.Mesh(startGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  startMesh.receiveShadow = true;
  group.add(startMesh);

  return { group, bounds };
}

/** Frees every geometry, material and texture under the group. */
export function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of materials) {
      for (const value of Object.values(m)) if (value && value.isTexture) value.dispose();
      m.dispose();
    }
  });
}

function indexedGeometry(positions, indices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

// Asphalt with a dashed white centre line; v repeats along the road, u spans its width.
function createLaneTexture() {
  const size = LANE_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = ASPHALT_COLOR;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = LANE_COLOR;
  ctx.fillRect(size * 0.48, 0, size * 0.04, size * 0.5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
