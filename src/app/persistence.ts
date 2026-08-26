// src/app/persistence.ts
//
// IndexedDB persistence via localforage (wrapped so a missing/blocked store never
// crashes — spec: NEVER break if storage is unavailable). Stores RobotSettings,
// named settings presets, and Block Coding projects (.rbk = Blockly workspace JSON).

import localforage from 'localforage';
import type { RobotSettings } from '../domain/settings';

const store =
  typeof window !== 'undefined'
    ? localforage.createInstance({ name: 'robotku', storeName: 'control' })
    : null;

const SETTINGS_KEY = 'settings';
const PROJECTS_KEY = 'projects';
const PRESETS_KEY = 'settingsPresets';
const TEMPLATES_KEY = 'templates';

async function safeGet<T>(key: string, fallback: T): Promise<T> {
  if (!store) return fallback;
  try {
    const v = await store.getItem<T>(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeSet<T>(key: string, value: T): Promise<void> {
  if (!store) return;
  try {
    await store.setItem(key, value);
  } catch {
    /* storage unavailable — ignore, app keeps working in-memory */
  }
}

/* ---- Settings ---- */
export function loadSettings(): Promise<RobotSettings | null> {
  return safeGet<RobotSettings | null>(SETTINGS_KEY, null);
}
export function persistSettings(s: RobotSettings): Promise<void> {
  return safeSet(SETTINGS_KEY, s);
}

/* ---- Settings presets (named) ---- */
export interface SettingsPreset {
  id: string;
  name: string;
  settings: RobotSettings;
  savedAt: number;
}
export function loadPresets(): Promise<SettingsPreset[]> {
  return safeGet<SettingsPreset[]>(PRESETS_KEY, []);
}
export function persistPresets(list: SettingsPreset[]): Promise<void> {
  return safeSet(PRESETS_KEY, list);
}

/* ---- Block Coding projects (.rbk) ---- */
export interface RbkProject {
  id: string;
  name: string;
  workspace: unknown; // Blockly.serialization.workspaces.save() output
  savedAt: number;
}
export function loadProjects(): Promise<RbkProject[]> {
  return safeGet<RbkProject[]>(PROJECTS_KEY, []);
}
export function persistProjects(list: RbkProject[]): Promise<void> {
  return safeSet(PROJECTS_KEY, list);
}

/* ---- User templates (Template Saya) ---- */
export interface UserTemplateRecord {
  id: string;
  name: string;
  savedAt: number;
  workspace: unknown; // Blockly.serialization.workspaces.save() output
}
export function loadUserTemplates(): Promise<UserTemplateRecord[]> {
  return safeGet<UserTemplateRecord[]>(TEMPLATES_KEY, []);
}
export function persistUserTemplates(list: UserTemplateRecord[]): Promise<void> {
  return safeSet(TEMPLATES_KEY, list);
}
