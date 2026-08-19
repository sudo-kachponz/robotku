// src/app/settingsStore.ts
//
// Framework-agnostic settings store (no React). Holds the effective RobotSettings
// consumed by every mode. Task 5 wires IndexedDB (localforage) load/save into
// the hooks below — the shape here stays stable.

import {
  DEFAULT_SETTINGS,
  cloneSettings,
  type RobotSettings,
} from '../domain/settings';

let current: RobotSettings = cloneSettings(DEFAULT_SETTINGS);
const listeners = new Set<(s: RobotSettings) => void>();

export function getSettings(): RobotSettings {
  return current;
}

export function subscribeSettings(cb: (s: RobotSettings) => void): () => void {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}

export function setSettings(next: RobotSettings): void {
  current = next;
  for (const l of listeners) l(current);
}

export function resetSettings(): void {
  setSettings(cloneSettings(DEFAULT_SETTINGS));
}
