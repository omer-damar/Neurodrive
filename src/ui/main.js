// App entry: owns UI state, the frame loop and input. The Simulation does the learning;
// this file only steps it, draws it and wires the panel.
import {
  DEFAULT_TRACK,
  STATS_UPDATE_HZ,
  STEPS_PER_SECOND,
  SPEED_MULTIPLIERS,
  MAX_MODE_FRAME_BUDGET_MS,
  MAX_POPULATION,
  SETTINGS_LIMITS,
} from '../core/config.js';
import { Track } from '../core/track.js';
import { Simulation, configForBrain } from '../core/simulation.js';
import { NeuralNetwork } from '../core/neuralNetwork.js';
import { PRETRAINED_BRAIN } from '../core/pretrained.js';
import { trackFromStroke, trackFromStored } from '../core/trackSketch.js';
import { TrackEditor } from './editor.js';
import { RaceMode } from './race.js';
import { Renderer2D } from './renderer2d.js';
import { FixedStepper } from './fixedStep.js';
import { t, applyTranslations, setLocale, getLocale, DEFAULT_LOCALE } from './i18n.js';
import { NetworkView } from './networkView.js';
import { FitnessChart } from './chart.js';
import { SETTING_NAMES, defaultSettings, clampSetting, formatSetting, sameSettings } from './settings.js';
import {
  saveBrain,
  loadSavedBrain,
  hasSavedBrain,
  downloadBrain,
  parseBrain,
  saveCustomTrack,
  loadCustomTrackJSON,
  clearRaceBest,
} from './storage.js';

const MAX_SPEED_MODE = 'max';
const PREFS_KEY = 'neurodrive.view';
const LANG_KEY = 'neurodrive.lang';
const CUSTOM_TRACK = 'custom'; // track-select value of the drawn track
const NOTICE_HIDE_MS = 6000; // success notices fade out; warnings stay until the next action

const els = {
  canvas: document.getElementById('canvas-2d'),
  viewport: document.getElementById('viewport-2d'),
  viewport3d: document.getElementById('viewport-3d'),
  viewButtons: document.querySelectorAll('.view-btn[data-view]'), // the language buttons share the style
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
  langButtons: document.querySelectorAll('.lang-btn'),
  networkCanvas: document.getElementById('network-canvas'),
  chartCanvas: document.getElementById('chart-canvas'),
  chartTooltip: document.getElementById('chart-tooltip'),
  chartEmpty: document.getElementById('chart-empty'),
  settingsFields: document.getElementById('settings-fields'),
  shadowsToggle: document.getElementById('shadows-toggle'),
  applySettings: document.getElementById('btn-apply-settings'),
  settingsPending: document.getElementById('settings-pending'),
  saveBrain: document.getElementById('btn-save-brain'),
  loadSaved: document.getElementById('btn-load-saved'),
  downloadBrain: document.getElementById('btn-download-brain'),
  brainFile: document.getElementById('brain-file'),
  loadPretrained: document.getElementById('btn-load-pretrained'),
  brainStatus: document.getElementById('brain-status'),
  drawTrack: document.getElementById('btn-draw-track'),
  customOption: document.getElementById('track-custom-option'),
  raceStart: document.getElementById('btn-race'),
  raceOpponent: document.getElementById('race-opponent'),
  raceChampion: document.getElementById('race-opponent-champion'),
};

const renderer = new Renderer2D(els.canvas);
const stepper = new FixedStepper();
const networkView = new NetworkView(els.networkCanvas);
const chart = new FitnessChart(els.chartCanvas, els.chartTooltip, els.chartEmpty);
const view = {
  showSensors: true,
  highlightLeader: true,
  visibleCount: Infinity,
  dimOthers: false,
  camera: 'chase',
  shadows: true,
  alpha: 1, // how far the frame is between two physics steps; renderers interpolate the cars
};

let activeView = '2d';
let renderer3d = null; // created on first switch to 3D
let loading3d = null;

let sim;
let running = true;
let speed = 1; // a multiplier from SPEED_MULTIPLIERS, or MAX_SPEED_MODE
let bestLapSteps = null; // all-time
let notice = null; // { key, params } of the visible notice, re-translated on language change
let noticeTimer = 0;
let customTrack = null; // the drawn track, if any (also in localStorage)
let previousTrackValue = DEFAULT_TRACK; // track-select value before the editor opened
const editor = new TrackEditor(els.canvas, { onFinish: finishDrawing });
const raceMode = new RaceMode(
  {
    start: els.raceStart,
    car: document.getElementById('race-car'),
    best: document.getElementById('race-best'),
    hud: document.getElementById('race-hud'),
    lap: document.getElementById('race-lap'),
    time: document.getElementById('race-time'),
    ai: document.getElementById('race-ai'),
    exit: document.getElementById('btn-race-exit'),
    countdown: document.getElementById('race-countdown'),
    result: document.getElementById('race-result'),
    winner: document.getElementById('race-winner'),
    summary: document.getElementById('race-summary'),
    again: document.getElementById('btn-race-again'),
    close: document.getElementById('btn-race-close'),
    touch: document.getElementById('race-touch'),
  },
  { onExit: endRace },
);
let pretrainedBrain = null; // parsed on first use
let chartLength = -1; // history length the chart last drew
// Training settings: `applied` runs now; `draft` is what the panel shows until "Start new training".
let appliedSettings = defaultSettings();
let draftSettings = { ...appliedSettings };
const settingInputs = {}; // name -> { input, output }
let brainMessage = null; // { key, params } shown in the brain section, re-translated on language change

/** @param {object} [sensor] ray range and spread of a loaded brain; defaults otherwise */
function newSimulation(track, sensor = {}) {
  sim = new Simulation(track, { ...appliedSettings, ...sensor });
  updateBrainButtons(); // a new run has no best brain yet
  sim.onGeneration = (stats) => {
    if (stats.bestLapSteps !== null && (bestLapSteps === null || stats.bestLapSteps < bestLapSteps)) {
      bestLapSteps = stats.bestLapSteps;
    }
  };
  sim.onTrackChange = setRendererTracks;
  bestLapSteps = null;
  chartLength = -1;
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
      // Sized for the largest population the settings allow, so a new training never rebuilds it.
      renderer3d = new Renderer3D(els.viewport3d, { capacity: MAX_POPULATION });
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

/** @param {{ ok?: boolean, params?: object }} [options] ok notices are green and hide after a while */
function showNotice(key, { ok = false, params = {} } = {}) {
  notice = { key, params };
  els.notice.textContent = t(key, params);
  els.notice.classList.toggle('notice-ok', ok);
  els.notice.hidden = false;
  clearTimeout(noticeTimer);
  if (ok) noticeTimer = setTimeout(hideNotice, NOTICE_HIDE_MS);
}

function hideNotice() {
  notice = null;
  clearTimeout(noticeTimer);
  els.notice.hidden = true;
}

function trackFor(value) {
  return value === CUSTOM_TRACK && customTrack ? customTrack : Track.preset(value);
}

// --- Track editor (2D only): the simulation pauses while a stroke is drawn ---
function startDrawing() {
  if (editor.active) {
    stopDrawing();
    return;
  }
  if (activeView !== '2d') setView('2d');
  previousTrackValue = els.trackSelect.value;
  editor.start();
  els.drawTrack.textContent = t('editor.cancel');
  els.drawTrack.classList.add('btn-primary');
  els.trackSelect.disabled = true;
  showNotice('editor.hint');
}

function stopDrawing() {
  editor.stop();
  els.drawTrack.textContent = t('editor.draw');
  els.drawTrack.classList.remove('btn-primary');
  els.trackSelect.disabled = false;
  hideNotice();
  stepper.reset();
}

// A valid drawing becomes the custom track and training continues on it with the same brains;
// an invalid one leaves the previous track in place.
function finishDrawing(points) {
  const result = trackFromStroke(points);
  stopDrawing();
  if (!result.ok) {
    els.trackSelect.value = previousTrackValue;
    showNotice('editor.invalid', { params: { reason: t(`error.${result.error}`) } });
    return;
  }
  customTrack = result.track;
  const stored = saveCustomTrack(customTrack);
  clearRaceBest(CUSTOM_TRACK); // a new drawing: old times no longer compare
  raceMode.updateBest(CUSTOM_TRACK);
  els.customOption.hidden = false;
  els.trackSelect.value = CUSTOM_TRACK;
  sim.setTrack(customTrack);
  showNotice(stored ? 'editor.saved' : 'editor.notStored', { ok: true });
}

// --- You vs AI: training waits while the player races the champion (or the pretrained brain) ---
function startRace() {
  if (editor.active) stopDrawing();
  const useChampion = els.raceOpponent.value === 'champion' && sim.bestBrain !== null;
  pretrainedBrain ??= NeuralNetwork.fromJSON(PRETRAINED_BRAIN);
  raceMode.view.camera = 'chase'; // from behind the player; the camera picker can still change it
  raceMode.view.shadows = view.shadows;
  els.cameraSelect.value = 'chase';
  setRaceLock(true);
  raceMode.start(sim.track, useChampion ? sim.bestBrain : pretrainedBrain, els.trackSelect.value);
}

function endRace() {
  setRaceLock(false);
  els.cameraSelect.value = view.camera;
  stepper.reset();
}

// The race runs on the current track, so it cannot change underneath it.
function setRaceLock(locked) {
  els.trackSelect.disabled = locked;
  els.drawTrack.disabled = locked;
  els.raceStart.disabled = locked;
}

// View and camera choice survive reloads; storage may be unavailable (private mode), so best effort.
function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ view: activeView, camera: view.camera, shadows: view.shadows }));
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

function loadLocale() {
  try {
    return localStorage.getItem(LANG_KEY) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Re-renders everything that is not a data-i18n element; called on start and on language change.
function setLanguage(name) {
  const active = setLocale(name);
  try {
    localStorage.setItem(LANG_KEY, active);
  } catch {
    /* ignore */
  }
  applyTranslations();
  for (const btn of els.langButtons) {
    const on = btn.dataset.lang === active;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  updatePlayLabel();
  for (const btn of els.speeds.querySelectorAll('button')) {
    if (btn.dataset.speed === MAX_SPEED_MODE) btn.textContent = t('controls.max');
  }
  if (notice) els.notice.textContent = t(notice.key, notice.params);
  els.drawTrack.textContent = t(editor.active ? 'editor.cancel' : 'editor.draw');
  if (brainMessage) showBrainMessage(brainMessage.key, brainMessage.params);
  raceMode.refresh(els.trackSelect.value);
  updateStats();
  networkView.render(leaderBrain());
  chart.setHistory(sim.history);
}

function leaderBrain() {
  const index = sim.cars.indexOf(sim.leader);
  return index >= 0 ? sim.brains[index] : null;
}

// One range input per training setting; limits come from config.js.
function buildSettings() {
  for (const name of SETTING_NAMES) {
    const [min, max, step] = SETTINGS_LIMITS[name];
    const field = document.createElement('label');
    field.className = 'field';
    const row = document.createElement('span');
    row.className = 'setting-row';
    const label = document.createElement('span');
    label.dataset.i18n = `settings.${name}`;
    const output = document.createElement('output');
    output.textContent = formatSetting(name, appliedSettings[name]);
    row.append(label, output);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(appliedSettings[name]);
    input.addEventListener('input', () => {
      draftSettings[name] = clampSetting(name, input.value);
      output.textContent = formatSetting(name, draftSettings[name]);
      els.settingsPending.hidden = sameSettings(draftSettings, appliedSettings);
    });
    field.append(row, input);
    els.settingsFields.append(field);
    settingInputs[name] = { input, output };
  }
}

function applySettings() {
  appliedSettings = { ...draftSettings };
  els.settingsPending.hidden = true;
  newSimulation(trackFor(els.trackSelect.value));
}

// Shows applied settings in the panel (after a brain changed the network size).
function syncSettingInputs() {
  draftSettings = { ...appliedSettings };
  for (const name of SETTING_NAMES) {
    settingInputs[name].input.value = String(appliedSettings[name]);
    settingInputs[name].output.textContent = formatSetting(name, appliedSettings[name]);
  }
  els.settingsPending.hidden = true;
}

function showBrainMessage(key, params = {}) {
  brainMessage = { key, params };
  els.brainStatus.textContent = t(key, params);
  els.brainStatus.hidden = false;
}

/**
 * Restarts training from one brain: the network size and sensors follow the brain (the panel
 * shows them), the population is the brain plus mutated copies.
 */
function startFromBrain(brain, messageKey) {
  const shape = configForBrain(brain);
  const fits = shape && ['hiddenNeurons', 'rayCount'].every((name) => clampSetting(name, shape[name]) === shape[name]);
  if (!fits) {
    showBrainMessage('brain.unsupported');
    return;
  }
  appliedSettings = { ...appliedSettings, hiddenNeurons: shape.hiddenNeurons, rayCount: shape.rayCount };
  syncSettingInputs();
  newSimulation(trackFor(els.trackSelect.value), { rayRange: shape.rayRange, raySpread: shape.raySpread });
  sim.seedFrom(brain);
  showBrainMessage(messageKey);
  updateBrainButtons();
}

// Save and download need a finished generation; loading needs a saved brain.
function updateBrainButtons() {
  const ready = sim.bestBrain !== null;
  els.saveBrain.disabled = !ready;
  els.downloadBrain.disabled = !ready;
  els.loadSaved.disabled = !hasSavedBrain();
  // Racing the champion needs one; otherwise the pretrained brain is the opponent.
  els.raceChampion.disabled = !ready;
  if (!ready && els.raceOpponent.value === 'champion') els.raceOpponent.value = 'pretrained';
}

function runSteps(frameMs) {
  if (!running) return;
  if (speed === MAX_SPEED_MODE) {
    const start = performance.now();
    do {
      for (let i = 0; i < 10; i++) sim.step(); // check the clock in small batches
    } while (performance.now() - start < MAX_MODE_FRAME_BUDGET_MS);
    view.alpha = 1;
    return;
  }
  const steps = stepper.advance(frameMs, speed);
  for (let i = 0; i < steps; i++) sim.step();
  view.alpha = stepper.alpha;
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
  updatePlayLabel();
  stepper.reset();
}

function updatePlayLabel() {
  els.playPause.textContent = t(running ? 'controls.pause' : 'controls.play');
  els.playPause.setAttribute('aria-pressed', String(running));
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
  if (raceMode.active) {
    raceMode.advance(now - lastTime, now);
    if (raceMode.active) activeRenderer().render(raceMode.race, raceMode.view);
  } else if (editor.active) {
    editor.render(); // the simulation waits while a track is drawn
  } else {
    runSteps(now - lastTime);
    activeRenderer().render(sim, view);
  }
  lastTime = now;
  if (now - lastStats >= 1000 / STATS_UPDATE_HZ) {
    updateStats();
    updateBrainButtons();
    networkView.render(leaderBrain());
    if (sim.history.length !== chartLength) {
      chart.setHistory(sim.history);
      chartLength = sim.history.length;
    }
    lastStats = now;
  }
  requestAnimationFrame(frame);
}

els.playPause.addEventListener('click', () => setRunning(!running));
els.nextGen.addEventListener('click', () => sim.endGeneration());
els.reset.addEventListener('click', () => newSimulation(trackFor(els.trackSelect.value)));
els.drawTrack.addEventListener('click', startDrawing);
els.raceStart.addEventListener('click', startRace);
els.raceOpponent.addEventListener('change', () => els.raceOpponent.blur());

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && editor.active) {
    stopDrawing();
    return;
  }
  if (raceMode.active) return; // the race handles its own keys
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setRunning(!running);
  }
});

// Changing track keeps the trained brains: a quick generalization test.
els.trackSelect.addEventListener('change', () => {
  sim.setTrack(trackFor(els.trackSelect.value));
  raceMode.updateBest(els.trackSelect.value);
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
  btn.addEventListener('click', () => {
    if (editor.active) stopDrawing(); // the editor lives in the 2D view
    setView(btn.dataset.view);
  });
}

for (const btn of els.langButtons) {
  btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
}

els.shadowsToggle.addEventListener('change', () => {
  view.shadows = els.shadowsToggle.checked;
  raceMode.view.shadows = view.shadows;
  savePrefs();
});

els.applySettings.addEventListener('click', applySettings);

els.saveBrain.addEventListener('click', () => {
  if (!sim.bestBrain) showBrainMessage('brain.none');
  else showBrainMessage(saveBrain(sim.bestBrain) ? 'brain.saved' : 'brain.saveFailed');
  updateBrainButtons();
});

els.loadSaved.addEventListener('click', () => {
  const brain = loadSavedBrain();
  if (brain) startFromBrain(brain, 'brain.loadedSaved');
  else showBrainMessage('brain.invalid');
});

els.downloadBrain.addEventListener('click', () => {
  if (!sim.bestBrain) {
    showBrainMessage('brain.none');
    return;
  }
  const name = `neurodrive-brain-gen${sim.generation - 1}.json`;
  downloadBrain(sim.bestBrain, name);
  showBrainMessage('brain.downloaded', { name });
});

els.brainFile.addEventListener('change', async () => {
  const file = els.brainFile.files[0];
  els.brainFile.value = ''; // the same file can be chosen again
  if (!file) return;
  try {
    startFromBrain(parseBrain(await file.text()), 'brain.loadedFile');
  } catch {
    showBrainMessage('brain.invalid');
  }
});

els.loadPretrained.addEventListener('click', () => {
  startFromBrain(NeuralNetwork.fromJSON(PRETRAINED_BRAIN), 'brain.loadedPretrained');
});

els.cameraSelect.addEventListener('change', () => {
  els.cameraSelect.blur();
  if (raceMode.active) {
    raceMode.view.camera = els.cameraSelect.value; // only for this race; training keeps its camera
    return;
  }
  view.camera = els.cameraSelect.value;
  savePrefs();
});

new ResizeObserver(() => {
  renderer.resize();
  if (editor.active) editor.resize();
}).observe(els.viewport);
new ResizeObserver(() => renderer3d?.resize()).observe(els.viewport3d);
new ResizeObserver(() => networkView.resize()).observe(els.networkCanvas);
new ResizeObserver(() => chart.resize()).observe(els.chartCanvas);

buildSettings();
setLocale(loadLocale());
applyTranslations();
buildSpeedButtons();
customTrack = trackFromStored(loadCustomTrackJSON());
els.customOption.hidden = customTrack === null;
els.trackSelect.value = DEFAULT_TRACK;
newSimulation(Track.preset(DEFAULT_TRACK));
setSpeed(1);
setRunning(true);
const prefs = loadPrefs();
if (['chase', 'top', 'orbit'].includes(prefs.camera)) view.camera = prefs.camera;
els.cameraSelect.value = view.camera;
if (typeof prefs.shadows === 'boolean') view.shadows = prefs.shadows;
els.shadowsToggle.checked = view.shadows;
setLanguage(getLocale()); // fills the language buttons and the dynamic texts
if (prefs.view === '3d') setView('3d');
requestAnimationFrame(frame);
