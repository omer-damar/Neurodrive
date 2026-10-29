// Brain persistence in the browser: localStorage (best effort, may be unavailable) and JSON files.
// Storage-facing functions take the storage object, so Node tests can pass a fake one; only
// downloadBrain() touches the DOM.
import { NeuralNetwork } from '../core/neuralNetwork.js';

export const BRAIN_STORAGE_KEY = 'neurodrive.brain';

/** window.localStorage, or null where reading it throws (private mode, blocked site data). */
export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Saves the brain; returns false when storage is missing, full or blocked. */
export function saveBrain(brain, storage = browserStorage()) {
  try {
    storage.setItem(BRAIN_STORAGE_KEY, JSON.stringify(brain.toJSON()));
    return true;
  } catch {
    return false;
  }
}

/** The saved brain, or null when there is none or it cannot be read. */
export function loadSavedBrain(storage = browserStorage()) {
  try {
    const text = storage.getItem(BRAIN_STORAGE_KEY);
    return text === null ? null : parseBrain(text);
  } catch {
    return null;
  }
}

export function hasSavedBrain(storage = browserStorage()) {
  try {
    return storage.getItem(BRAIN_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export const TRACK_STORAGE_KEY = 'neurodrive.customTrack';

/** Saves a custom (drawn) track's control points; false when storage is unavailable. */
export function saveCustomTrack(track, storage = browserStorage()) {
  try {
    storage.setItem(TRACK_STORAGE_KEY, JSON.stringify(track.toJSON()));
    return true;
  } catch {
    return false;
  }
}

/** The stored custom track as plain JSON (rebuilt and validated by core/trackSketch.js), or null. */
export function loadCustomTrackJSON(storage = browserStorage()) {
  try {
    const text = storage.getItem(TRACK_STORAGE_KEY);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

export function brainToText(brain) {
  return `${JSON.stringify(brain.toJSON(), null, 2)}\n`;
}

/** Parses a brain file's text; throws on invalid JSON or a malformed brain. */
export function parseBrain(text) {
  return NeuralNetwork.fromJSON(JSON.parse(text));
}

/** Offers the brain as a .json download. */
export function downloadBrain(brain, filename) {
  const url = URL.createObjectURL(new Blob([brainToText(brain)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
