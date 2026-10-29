import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Race, RACE_PHASES } from '../src/core/race.js';
import { Track } from '../src/core/track.js';
import { NeuralNetwork } from '../src/core/neuralNetwork.js';
import { PRETRAINED_BRAIN } from '../src/core/pretrained.js';
import { RACE_COUNTDOWN_STEPS, RACE_RESPAWN_STEPS, RACE_LANE_OFFSET, LAPS } from '../src/core/config.js';
import { DriveInput, loadPlayerCar, DEFAULT_PLAYER_CAR, PLAYER_CAR_MODELS } from '../src/ui/race.js';
import { loadRaceBests, saveRaceResult, clearRaceBest, RACE_STORAGE_KEY } from '../src/ui/storage.js';

const oval = Track.preset('oval');
const pretrained = () => NeuralNetwork.fromJSON(PRETRAINED_BRAIN);
const parked = () => new NeuralNetwork([8, 6, 2]); // all weights 0: never touches the throttle

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }
  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }
  setItem(key, value) {
    this.items.set(key, String(value));
  }
}

// Player stand-in: steer towards a centre point a few indices ahead, hold a moderate speed.
function pursuit(car, lookAhead = 6, targetSpeed = 3) {
  const n = car.track.n;
  const i = (car.trackIdx + lookAhead) % n;
  let diff = Math.atan2(car.track.center[i * 2 + 1] - car.y, car.track.center[i * 2] - car.x) - car.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return [car.speed < targetSpeed ? 1 : 0, Math.max(-1, Math.min(1, diff * 4))];
}

function runToEnd(race, maxSteps = 20000) {
  for (let s = 0; s < maxSteps && race.phase !== RACE_PHASES.FINISHED; s++) race.step(...pursuit(race.player));
}

test('the cars start side by side on the start line', () => {
  const race = new Race(oval, pretrained());
  const { player, ai } = race;
  assert.ok(Math.abs(Math.hypot(player.x - ai.x, player.y - ai.y) - 2 * RACE_LANE_OFFSET) < 1e-9);
  assert.ok(Math.abs(Math.hypot(player.x - oval.startX, player.y - oval.startY) - RACE_LANE_OFFSET) < 1e-9);
  assert.ok(player.alive && ai.alive);
  assert.equal(race.leader, player);
  assert.deepEqual(race.cars, [player, ai]);
});

test('nobody moves during the 3-2-1 countdown', () => {
  const race = new Race(oval, pretrained());
  const x = race.player.x;
  assert.equal(race.countdownSeconds, 3);
  for (let s = 0; s < RACE_COUNTDOWN_STEPS - 1; s++) race.step(1, 0);
  assert.equal(race.countdownSeconds, 1);
  assert.equal(race.phase, RACE_PHASES.COUNTDOWN);
  assert.equal(race.player.x, x);
  assert.equal(race.ai.speed, 0);
  race.step(1, 0);
  assert.equal(race.phase, RACE_PHASES.RACING);
  race.step(1, 0);
  assert.ok(race.player.speed > 0);
  assert.equal(race.time, 1);
});

test('a crashed car is put back on the road after a wait, laps kept', () => {
  const race = new Race(oval, parked());
  for (let s = 0; s < RACE_COUNTDOWN_STEPS; s++) race.step(0, 0);
  let s = 0;
  while (race.player.alive && s++ < 2000) race.step(1, 1); // full lock into a wall
  assert.equal(race.player.alive, false);
  const idx = race.player.trackIdx;
  race.step(1, 0);
  assert.equal(race.playerResult.crashes, 1);
  for (let k = 0; k < RACE_RESPAWN_STEPS - 1; k++) race.step(1, 0);
  assert.equal(race.player.alive, false, 'still waiting');
  race.step(1, 0);
  assert.ok(race.player.alive);
  assert.equal(race.player.speed, 0);
  assert.equal(race.player.trackIdx, idx);
  assert.equal(race.player.x, oval.center[idx * 2]);
});

test('a race ends when the player finishes; lap times add up to the total', () => {
  const race = new Race(oval, parked());
  runToEnd(race);
  assert.equal(race.phase, RACE_PHASES.FINISHED);
  assert.equal(race.winner, 'player'); // the parked AI never started
  const player = race.playerResult;
  const laps = race.lapTimes(player);
  assert.equal(laps.length, LAPS);
  assert.equal(laps.reduce((a, b) => a + b, 0), race.totalTime(player));
  assert.equal(race.totalTime(race.aiResult), null);
  const time = race.time;
  race.step(1, 0);
  assert.equal(race.time, time, 'a finished race does not run on');
});

test('the pretrained AI beats a careful driver', () => {
  const race = new Race(oval, pretrained());
  runToEnd(race);
  assert.equal(race.winner, 'ai');
  assert.ok(race.totalTime(race.aiResult) < race.totalTime(race.playerResult));
});

test('DriveInput: opposite controls cancel, a control stays held while any key holds it', () => {
  const input = new DriveInput();
  input.press('gas');
  input.press('left');
  assert.deepEqual([input.throttle, input.steer], [1, -1]);
  input.press('right');
  assert.equal(input.steer, 0);
  input.press('gas'); // W and ArrowUp together
  input.release('gas');
  assert.equal(input.throttle, 1);
  input.release('gas');
  input.press('brake');
  assert.equal(input.throttle, -1);
  input.clear();
  assert.deepEqual([input.throttle, input.steer], [0, 0]);
});

test('race bests keep the faster time per field and per track', () => {
  const storage = new MemoryStorage();
  assert.deepEqual(loadRaceBests(storage), {});
  assert.deepEqual(saveRaceResult('oval', { total: 900, lap: 280 }, storage), { total: 900, lap: 280, newTotal: true, newLap: true });
  assert.deepEqual(saveRaceResult('oval', { total: 950, lap: 270 }, storage), { total: 900, lap: 270, newTotal: false, newLap: true });
  saveRaceResult('classic', { total: 1500, lap: 480 }, storage);
  assert.deepEqual(loadRaceBests(storage).oval, { total: 900, lap: 270 });
  clearRaceBest('oval', storage);
  assert.deepEqual(Object.keys(loadRaceBests(storage)), ['classic']);
  storage.setItem(RACE_STORAGE_KEY, '[1, 2]');
  assert.deepEqual(loadRaceBests(storage), {});
  storage.setItem(RACE_STORAGE_KEY, '{oops');
  assert.deepEqual(loadRaceBests(storage), {});
});

test('the player car falls back to the default for unknown or missing choices', () => {
  const storage = new MemoryStorage();
  assert.equal(loadPlayerCar(storage), DEFAULT_PLAYER_CAR);
  storage.setItem('neurodrive.playerCar', 'camaro');
  assert.equal(loadPlayerCar(storage), 'camaro');
  storage.setItem('neurodrive.playerCar', 'race'); // a Kenney model, not a player choice
  assert.equal(loadPlayerCar(storage), DEFAULT_PLAYER_CAR);
  assert.equal(PLAYER_CAR_MODELS.length, 6);
});
