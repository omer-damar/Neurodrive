// "You vs AI" mode (Phase 8): keyboard/touch input, the race HUD, the result screen and the
// player's car model. The race itself (countdown, laps, respawns, winner) is core/race.js;
// main.js steps it at 1× with the same fixed-step loop and draws it with the active renderer.
import { STEPS_PER_SECOND, STATS_UPDATE_HZ } from '../core/config.js';
import { Race, RACE_PHASES } from '../core/race.js';
import { t } from './i18n.js';
import { FixedStepper } from './fixedStep.js';
import { browserStorage, loadRaceBests, saveRaceResult } from './storage.js';

// The six Poly Pizza models (CC BY 3.0, assets/models/LICENSE.md) the player can drive.
export const PLAYER_CAR_MODELS = Object.freeze(['rx7', 'charger', 'muscle-car', 'convertible', 'camaro', 'aventador']);
export const DEFAULT_PLAYER_CAR = 'rx7';
export const AI_CAR_MODEL = 'race'; // Kenney race car, so the two cars never look alike
const CAR_STORAGE_KEY = 'neurodrive.playerCar';
const GO_SHOW_STEPS = STEPS_PER_SECOND; // "GO!" stays up for a second after the countdown

export const KEY_ACTIONS = Object.freeze({
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
});

/** Held controls (keys and touch buttons) -> throttle and steer in -1..1. */
export class DriveInput {
  constructor() {
    this.held = new Map(); // action -> number of keys/pointers holding it
  }

  press(action) {
    this.held.set(action, (this.held.get(action) ?? 0) + 1);
  }

  release(action) {
    const count = (this.held.get(action) ?? 0) - 1;
    if (count > 0) this.held.set(action, count);
    else this.held.delete(action);
  }

  clear() {
    this.held.clear();
  }

  get throttle() {
    return (this.held.has('gas') ? 1 : 0) - (this.held.has('brake') ? 1 : 0);
  }

  get steer() {
    return (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
  }
}

/** The stored player car, or the default when none (or an unknown one) is stored. */
export function loadPlayerCar(storage = browserStorage()) {
  try {
    const name = storage.getItem(CAR_STORAGE_KEY);
    return PLAYER_CAR_MODELS.includes(name) ? name : DEFAULT_PLAYER_CAR;
  } catch {
    return DEFAULT_PLAYER_CAR;
  }
}

function savePlayerCar(name, storage = browserStorage()) {
  try {
    storage.setItem(CAR_STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}

function seconds(steps) {
  return t('unit.seconds', { value: (steps / STEPS_PER_SECOND).toFixed(2) });
}

export class RaceMode {
  /**
   * @param {Record<string, HTMLElement>} els panel and HUD elements (see index.html)
   * @param {{ onExit: () => void }} callbacks onExit runs after the HUD is closed
   */
  constructor(els, { onExit }) {
    this.els = els;
    this.onExit = onExit;
    this.input = new DriveInput();
    this.stepper = new FixedStepper();
    this.race = null;
    this.trackKey = null;
    this.saved = null; // bests after the finished race
    this.lastHud = 0;
    this.carModel = loadPlayerCar();
    // Race view: the player is the highlighted car; no sensors, every car fully visible.
    this.view = {
      showSensors: false,
      highlightLeader: true,
      visibleCount: Infinity,
      dimOthers: false,
      camera: 'chase',
      shadows: true,
      carModels: [this.carModel, AI_CAR_MODEL],
      alpha: 1,
    };
    this.#buildModelSelect();
    this.#bindInput();
    els.exit.addEventListener('click', () => this.stop());
    els.close.addEventListener('click', () => this.stop());
    els.again.addEventListener('click', () => this.restart());
  }

  get active() {
    return this.race !== null;
  }

  /** Starts a race of the player against `brain` on `track`; trackKey names the track's bests. */
  start(track, brain, trackKey) {
    this.race = new Race(track, brain);
    this.trackKey = trackKey;
    this.saved = null;
    this.input.clear();
    this.stepper.reset();
    this.els.hud.hidden = false;
    this.els.result.hidden = true;
    this.els.start.blur();
    this.#renderHud();
  }

  restart() {
    this.start(this.race.track, this.race.brain, this.trackKey);
  }

  stop() {
    if (!this.race) return;
    this.race = null;
    this.input.clear();
    this.els.hud.hidden = true;
    this.onExit();
  }

  /** Steps the race at real-time speed for one frame and refreshes the HUD a few times a second. */
  advance(frameMs, now) {
    const race = this.race;
    const steps = this.stepper.advance(frameMs, 1);
    for (let i = 0; i < steps && race.phase !== RACE_PHASES.FINISHED; i++) {
      race.step(this.input.throttle, this.input.steer);
    }
    this.view.alpha = this.stepper.alpha;
    if (race.phase === RACE_PHASES.FINISHED && this.saved === null) this.#finish();
    if (race.phase === RACE_PHASES.COUNTDOWN || now - this.lastHud >= 1000 / STATS_UPDATE_HZ) {
      this.#renderHud();
      this.lastHud = now;
    }
  }

  /** Re-translates the panel and HUD (language change); trackKey is the selected track. */
  refresh(trackKey) {
    for (const option of this.els.car.options) option.textContent = t(`race.model.${option.value}`);
    this.updateBest(trackKey);
    if (this.race) this.#renderHud();
    if (this.saved) this.#renderResult();
  }

  /** Shows the player's record on a track in the panel. */
  updateBest(trackKey) {
    const best = loadRaceBests()[trackKey];
    this.els.best.textContent = best
      ? t('race.best', { total: seconds(best.total), lap: seconds(best.lap) })
      : t('race.noBest');
  }

  #buildModelSelect() {
    for (const name of PLAYER_CAR_MODELS) {
      const option = document.createElement('option');
      option.value = name;
      this.els.car.append(option);
    }
    this.els.car.value = this.carModel;
    this.els.car.addEventListener('change', () => {
      this.carModel = this.els.car.value;
      this.view.carModels[0] = this.carModel;
      savePlayerCar(this.carModel);
      this.els.car.blur();
    });
  }

  #bindInput() {
    window.addEventListener('keydown', (event) => {
      if (!this.race) return;
      if (event.code === 'Escape') {
        this.stop();
        return;
      }
      const action = KEY_ACTIONS[event.code];
      if (!action) return;
      event.preventDefault(); // arrows would scroll the page or change a focused select
      if (!event.repeat) this.input.press(action);
    });
    window.addEventListener('keyup', (event) => {
      const action = KEY_ACTIONS[event.code];
      if (action && this.race) this.input.release(action);
    });
    window.addEventListener('blur', () => this.input.clear()); // keys released elsewhere never arrive
    // On-screen buttons for touch screens (shown by CSS on coarse pointers).
    for (const button of this.els.touch.querySelectorAll('[data-action]')) {
      const action = button.dataset.action;
      let pressed = false;
      const up = () => {
        if (pressed) this.input.release(action);
        pressed = false;
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        if (!pressed) this.input.press(action);
        pressed = true;
      });
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('lostpointercapture', up);
    }
  }

  #finish() {
    const race = this.race;
    const player = race.playerResult;
    const total = race.totalTime(player);
    const lap = Math.min(...race.lapTimes(player));
    this.saved = saveRaceResult(this.trackKey, { total, lap });
    this.updateBest(this.trackKey);
    this.#renderHud(); // final lap and time, not the last throttled refresh
    this.#renderResult();
    this.els.result.hidden = false;
    this.els.again.focus();
  }

  #renderHud() {
    const race = this.race;
    const els = this.els;
    const laps = race.laps;
    const playerLap = Math.min(race.player.lap + 1, laps);
    els.lap.textContent = t('race.lap', { lap: playerLap, laps });
    els.time.textContent = seconds(race.time);
    const aiTotal = race.totalTime(race.aiResult);
    els.ai.textContent = aiTotal === null
      ? t('race.aiLap', { lap: Math.min(race.ai.lap + 1, laps), laps })
      : t('race.aiFinished', { time: seconds(aiTotal) });

    let big = '';
    if (race.phase === RACE_PHASES.COUNTDOWN) big = String(race.countdownSeconds);
    else if (race.phase === RACE_PHASES.RACING && race.time < GO_SHOW_STEPS) big = t('race.go');
    else if (race.phase === RACE_PHASES.RACING && !race.player.alive) big = t('race.crash');
    els.countdown.textContent = big;
    els.countdown.hidden = big === '';
  }

  #renderResult() {
    const race = this.race;
    const els = this.els;
    const saved = this.saved;
    els.winner.textContent = t(race.winner === 'player' ? 'race.won' : 'race.lost');
    els.winner.classList.toggle('race-lost', race.winner !== 'player');
    const aiTotal = race.totalTime(race.aiResult);
    const rows = [
      [t('race.yourTime'), seconds(race.totalTime(race.playerResult)) + (saved.newTotal ? ` · ${t('race.record')}` : '')],
      [t('race.aiTime'), aiTotal === null ? t('race.aiNotFinished', { lap: race.ai.lap, laps: race.laps }) : seconds(aiTotal)],
      [t('race.bestLap'), seconds(Math.min(...race.lapTimes(race.playerResult))) + (saved.newLap ? ` · ${t('race.record')}` : '')],
      [t('race.crashes'), String(race.playerResult.crashes)],
    ];
    els.summary.replaceChildren(
      ...rows.flatMap(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }
}
