// Training settings shown in the panel: limits, snapping and formatting. Pure (tested in Node);
// main.js turns the values into a Simulation config when a new training starts.
import { SETTINGS_LIMITS } from '../core/config.js';
import { DEFAULT_SIM_CONFIG } from '../core/simulation.js';

export const SETTING_NAMES = Object.freeze(Object.keys(SETTINGS_LIMITS));

/** The simulation defaults for every panel setting. */
export function defaultSettings() {
  return Object.fromEntries(SETTING_NAMES.map((name) => [name, DEFAULT_SIM_CONFIG[name]]));
}

/** Clamps a raw input value into the setting's range and snaps it to the step; junk gives the default. */
export function clampSetting(name, value) {
  const [min, max, step] = SETTINGS_LIMITS[name];
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_SIM_CONFIG[name];
  const clamped = Math.min(max, Math.max(min, number));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.min(max, snapped).toFixed(decimals(step)));
}

/** Display text for a value, e.g. mutation rate 0.1 -> "0.10". */
export function formatSetting(name, value) {
  return value.toFixed(decimals(SETTINGS_LIMITS[name][2]));
}

export function sameSettings(a, b) {
  return SETTING_NAMES.every((name) => a[name] === b[name]);
}

function decimals(step) {
  const text = String(step);
  return text.includes('.') ? text.split('.')[1].length : 0;
}
