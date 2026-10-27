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

const els = {
  canvas: document.getElementById('canvas-2d'),
  viewport: document.getElementById('viewport-2d'),
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
const view = { showSensors: true, highlightLeader: true, visibleCount: Infinity, dimOthers: false };

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
  sim.onTrackChange = (nextTrack) => renderer.setTrack(nextTrack);
  bestLapSteps = null;
  renderer.setTrack(track);
  stepper.reset();
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
  renderer.render(sim, view);
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

new ResizeObserver(() => renderer.resize()).observe(els.viewport);

applyTranslations();
buildSpeedButtons();
els.trackSelect.value = DEFAULT_TRACK;
newSimulation(Track.preset(DEFAULT_TRACK));
setSpeed(1);
setRunning(true);
requestAnimationFrame(frame);
