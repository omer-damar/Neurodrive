// Central constants and defaults. Every tunable number lives here.
// Pure module: no DOM, no three — shared by the browser, tests and headless training.

// --- World and time (4.1) ---
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;
export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND; // one fixed physics step; speeds are units per step

// --- Randomness (4.2) ---
export const DEFAULT_SEED = 42;

// --- Track (4.3) ---
export const TRACK_WIDTH = 80;
export const RESAMPLE_SPACING = 10; // arc-length spacing of centre points
export const SPLINE_SUBDIVISIONS = 20; // Catmull-Rom samples per control-point segment
export const MIN_CONTROL_POINTS = 4;
export const SHARP_TURN_WINDOW = 16; // wall crossings closer than this (in indices) count as a sharp turn
export const NEAREST_SEARCH_WINDOW = 8; // nearestIndex searches hint ± this many points
export const TRACK_PRESETS = Object.freeze(['oval', 'classic', 'technical']);
export const DEFAULT_TRACK = 'classic';

// --- Spatial grid (4.4) ---
export const GRID_CELL_SIZE = 50;

// --- Car physics (4.5) ---
export const ACCEL = 0.12;
export const FRICTION = 0.99;
export const MAX_SPEED = 5; // must stay below CAR_LENGTH to avoid tunnelling through walls
export const TURN_RATE = 0.065;
export const GRIP_FULL_SPEED = 2; // grip ramps from 0 to 1 as speed goes 0 -> this
export const HIGH_SPEED_GRIP_LOSS = 0.4; // fraction of grip lost at MAX_SPEED
export const CAR_LENGTH = 22;
export const CAR_WIDTH = 11;

// --- Sensors (4.5) ---
export const RAY_COUNT = 7;
export const RAY_SPREAD = (135 * Math.PI) / 180; // total fan width, i.e. ±67.5°
export const RAY_RANGE = 200;

// --- Termination and fitness (4.5) ---
export const STUCK_STEPS = 150; // ~2.5 s without new progress
export const REVERSE_TOLERANCE = 30; // die if progress < maxProgress - this
export const LAPS = 3;
export const MAX_STEPS = 3600; // 60 s per generation

// --- Neural network (4.6) ---
export const HIDDEN_NEURONS = 6;
export const OUTPUT_COUNT = 2; // 0 = steer, 1 = throttle
export const WEIGHT_INIT_RANGE = 1; // initial weights ~ U(-range, range)
export const BRAIN_FORMAT_VERSION = 1;

// --- Genetic algorithm (4.7) ---
export const POPULATION_SIZE = 100;
export const ELITE_COUNT = 2;
export const TOURNAMENT_SIZE = 3;
export const MUTATION_RATE = 0.1;
export const MUTATION_STRENGTH = 0.5;

// --- UI loop (4.9) ---
export const SPEED_MULTIPLIERS = Object.freeze([1, 2, 5, 10, 20]);
export const MAX_MODE_FRAME_BUDGET_MS = 12; // "Max" speed: step until this budget is used
export const STATS_UPDATE_HZ = 10;
export const MAX_FRAME_DT_MS = 100; // longer frame gaps (tab switch, breakpoint) are clamped
export const MAX_STEPS_PER_FRAME = 120; // fixed-step catch-up limit; leftover time is dropped

// --- Settings panel (Phase 5): [min, max, step] for each training setting ---
export const SETTINGS_LIMITS = Object.freeze({
  populationSize: Object.freeze([20, 300, 10]),
  mutationRate: Object.freeze([0.01, 0.5, 0.01]),
  hiddenNeurons: Object.freeze([4, 16, 1]),
  rayCount: Object.freeze([3, 9, 1]),
});
export const MAX_POPULATION = SETTINGS_LIMITS.populationSize[1]; // 3D instance buffers are sized for this

// --- 3D view (4.1, 4.10) ---
export const SCALE = 0.05; // world unit -> metres in three.js (1 unit = 5 cm)
export const BARRIER_HEIGHT = 0.6; // metres
export const THREE_VERSION = '0.160.0'; // must match the importmap in index.html
