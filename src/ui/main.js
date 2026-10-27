// App entry: owns UI state, the frame loop and input. The Simulation does the learning;
// this file only steps it, draws it and wires the panel.
import {
  DEFAULT_TRACK,
  STATS_UPDATE_HZ,
  STEPS_PER_SECOND,
  SPEED_MULTIPLIERS,
  MAX_MODE_FRAME_BUDGET_MS,
} from '../core/config.js';
import { Track } from '../core/track.js';
import { Simulation } from '../core/simulation.js';
import { Renderer2D } from './renderer2d.js';
import { FixedStepper } from './fixedStep.js';
import { t, applyTranslations } from './i18n.js';

const MAX_SPEED_MODE = 'max';
const PREFS_KEY = 'neurodrive.view';

const els = {
  canvas: document.getElementById('canvas-2d'),
  viewport: document.getElementById('viewport-2d'),
  viewport3d: document.getElementById('viewport-3d'),
  viewButtons: document.querySelectorAll('.view-btn'),
  cameraPicker: document.getElementById('camera-picker'),
  cameraSelect: document.getElementById('camera-select'),
  notice: document.getElementById('view-notice'),
  trackSelect: document.getElementById('track-select'),
  crowdSelect: document.getElementById('crowd-select'),
  sensorsToggle: document.getElementById('sensors-toggle'),
  playPause: document.getElementById('btn-play'),
  nextGen: document.getElementById('btn-next'),
  reset: document.getElementById('btn-reset'),
  speeds: document.getElementById('speed-buttons'),
  generation: document.getElementById('stat-generation'),
  alive: document.getElementById('stat-alive'),
  best: document.getElementById('stat-best'),
  finished: document.getElementById('stat-finished'),
  bestLap: document.getElementById('stat-lap'),
  lastGen: document.getElementById('stat-last'),
};

const renderer = new Renderer2D(els.canvas);
const stepper = new FixedStepper();
const view = { showSensors: true, highlightLeader: true, visibleCount: Infinity, dimOthers: false, camera: 'chase' };

let activeView = '2d';
let renderer3d = null; // created on first switch to 3D
let loading3d = null;

let sim;
let running = true;
let speed = 1; // a multiplier from SPEED_MULTIPLIERS, or MAX_SPEED_MODE
let bestLapSteps = null; // all-time

function newSimulation(track) {
  sim = new Simulation(track);
  sim.onGeneration = (stats) => {
    if (stats.bestLapSteps !== null && (bestLapSteps === null || stats.bestLapSteps < bestLapSteps)) {
      bestLapSteps = stats.bestLapSteps;
    }
  };
  sim.onTrackChange = setRendererTracks;
  bestLapSteps = null;
  setRendererTracks(track);
  stepper.reset();
}

// Both renderers keep the current track so switching views needs no rebuild.
function setRendererTracks(track) {
  renderer.setTrack(track);
  if (renderer3d) renderer3d.setTrack(track);
}

function activeRenderer() {
  return activeView === '3d' && renderer3d ? renderer3d : renderer;
}

async function ensureRenderer3d() {
  if (renderer3d) return renderer3d;
  if (!hasWebGL2()) throw new Error('view.noWebgl');
  loading3d ??= import('./three/renderer3d.js')
    .then(({ Renderer3D }) => {
      renderer3d = new Renderer3D(els.viewport3d, { capacity: sim.cars.length });
      renderer3d.setTrack(sim.track);
      // Models stream in afterwards; box cars are shown meanwhile and kept if loading fails.
      renderer3d.loadModels().catch((error) => console.warn('3D models unavailable', error));
      return renderer3d;
    })
    .catch((error) => {
      loading3d = null; // allow a retry, e.g. once the network is back
      console.error(error);
      throw new Error('view.load3dFailed');
    });
  return loading3d;
}

function hasWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

async function setView(name) {
  if (name === '3d') {
    showNotice('view.loading3d');
    for (const btn of els.viewButtons) btn.disabled = true;
    try {
      await ensureRenderer3d();
      hideNotice();
    } catch (error) {
      showNotice(error.message);
      name = '2d';
    } finally {
      for (const btn of els.viewButtons) btn.disabled = false;
    }
  }
  activeView = name;
  els.viewport.hidden = name !== '2d';
  els.viewport3d.hidden = name !== '3d';
  els.cameraPicker.hidden = name !== '3d';
  for (const btn of els.viewButtons) {
    const active = btn.dataset.view === name;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
  activeRenderer().resize();
  savePrefs();
}

function showNotice(key) {
  els.notice.textContent = t(key);
  els.notice.hidden = false;
}

function hideNotice() {
  els.notice.hidden = true;
}

// View and camera choice survive reloads; storage may be unavailable (private mode), so best effort.
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ view: activeView, camera: view.camera }));
  } catch {
    /* ignore */
  }
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {};
  } catch {
    return {};
  }
}

function runSteps(frameMs) {
  if (!running) return;
  if (speed === MAX_SPEED_MODE) {
    const start = performance.now();
    do {
      for (let i = 0; i < 10; i++) sim.step(); // check the clock in small batches
    } while (performance.now() - start < MAX_MODE_FRAME_BUDGET_MS);
    return;
  }
  const steps = stepper.advance(frameMs, speed);
  for (let i = 0; i < steps; i++) sim.step();
}

function seconds(steps) {
  return t('unit.seconds', { value: (steps / STEPS_PER_SECOND).toFixed(2) });
}

function updateStats() {
  let alive = 0;
  let finished = 0;
  for (const car of sim.cars) {
    if (car.finished) finished++;
    else if (car.alive) alive++;
  }
  els.generation.textContent = String(sim.generation);
  els.alive.textContent = `${alive} / ${sim.cars.length}`;
  els.finished.textContent = String(finished);
  els.best.textContent = Number.isFinite(sim.bestFitness) ? sim.bestFitness.toFixed(3) : '–';
  els.bestLap.textContent = bestLapSteps === null ? '–' : seconds(bestLapSteps);
  const last = sim.history.at(-1);
  els.lastGen.textContent = last ? t('status.lastValue', { best: last.best.toFixed(2), avg: last.avg.toFixed(2) }) : '–';
}

function setRunning(value) {
  running = value;
  els.playPause.textContent = t(running ? 'controls.pause' : 'controls.play');
  els.playPause.setAttribute('aria-pressed', String(running));
  stepper.reset();
}

function setSpeed(value) {
  speed = value;
  for (const btn of els.speeds.querySelectorAll('button')) {
    const active = btn.dataset.speed === String(value);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
  stepper.reset();
}

function buildSpeedButtons() {
  for (const value of [...SPEED_MULTIPLIERS, MAX_SPEED_MODE]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.dataset.speed = String(value);
    btn.textContent = value === MAX_SPEED_MODE ? t('controls.max') : `${value}×`;
    btn.addEventListener('click', () => setSpeed(value));
    els.speeds.appendChild(btn);
  }
}

let lastTime = performance.now();
let lastStats = 0;

function frame(now) {
  runSteps(now - lastTime);
  lastTime = now;
  activeRenderer().render(sim, view);
  if (now - lastStats >= 1000 / STATS_UPDATE_HZ) {
    updateStats();
    lastStats = now;
  }
  requestAnimationFrame(frame);
}

els.playPause.addEventListener('click', () => setRunning(!running));
els.nextGen.addEventListener('click', () => sim.endGeneration());
els.reset.addEventListener('click', () => newSimulation(Track.preset(els.trackSelect.value)));

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setRunning(!running);
  }
});

// Changing track keeps the trained brains: a quick generalization test.
els.trackSelect.addEventListener('change', () => {
  sim.setTrack(Track.preset(els.trackSelect.value));
  els.trackSelect.blur();
});

// Crowd display: all cars (default), only the 10 furthest, or everyone but the leader dimmed.
els.crowdSelect.addEventListener('change', () => {
  const mode = els.crowdSelect.value;
  view.visibleCount = mode === 'top10' ? 10 : Infinity;
  view.dimOthers = mode === 'dim';
  els.crowdSelect.blur();
});

els.sensorsToggle.addEventListener('change', () => {
  view.showSensors = els.sensorsToggle.checked;
});

for (const btn of els.viewButtons) {
  btn.addEventListener('click', () => setView(btn.dataset.view));
}

els.cameraSelect.addEventListener('change', () => {
  view.camera = els.cameraSelect.value;
  els.cameraSelect.blur();
  savePrefs();
});

new ResizeObserver(() => renderer.resize()).observe(els.viewport);
new ResizeObserver(() => renderer3d?.resize()).observe(els.viewport3d);

applyTranslations();
buildSpeedButtons();
els.trackSelect.value = DEFAULT_TRACK;
newSimulation(Track.preset(DEFAULT_TRACK));
setSpeed(1);
setRunning(true);
const prefs = loadPrefs();
if (['chase', 'top', 'orbit'].includes(prefs.camera)) view.camera = prefs.camera;
els.cameraSelect.value = view.camera;
if (prefs.view === '3d') setView('3d');
requestAnimationFrame(frame);
