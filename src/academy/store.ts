// src/academy/store.ts
//
// Robotku Academy session + progress persistence (IndexedDB via localforage).
// Mirrors the safe-wrapper pattern in src/app/persistence.ts: storage is always
// optional — a blocked/absent store degrades to in-memory and never throws.

import localforage from 'localforage';

const store =
  typeof window !== 'undefined'
    ? localforage.createInstance({ name: 'robotku', storeName: 'academy' })
    : null;

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
    /* storage unavailable — ignore */
  }
}

// ---- Access session ------------------------------------------------------

export type AccessMode = 'guest' | 'code';

export interface AcademySession {
  mode: AccessMode | null; // null = never entered the gate
  accessCode?: string; // stored when unlocked via a code
}

const SESSION_KEY = 'session';

// Demo access codes. Real validation would hit a licensing backend; here we
// accept a small allow-list (case-insensitive) so the gate is testable.
const VALID_CODES = new Set(['ROBOTKU', 'ROBOTKU2026', 'GURU2026', 'DEMO']);

export function isValidCode(code: string): boolean {
  return VALID_CODES.has(code.trim().toUpperCase());
}

export function loadSession(): Promise<AcademySession> {
  return safeGet<AcademySession>(SESSION_KEY, { mode: null });
}

export async function enterAsGuest(): Promise<void> {
  await safeSet<AcademySession>(SESSION_KEY, { mode: 'guest' });
}

export async function unlockWithCode(code: string): Promise<boolean> {
  if (!isValidCode(code)) return false;
  await safeSet<AcademySession>(SESSION_KEY, { mode: 'code', accessCode: code.trim() });
  return true;
}

// ---- Folder open/closed state -------------------------------------------

const FOLDERS_KEY = 'folderState';

export function loadFolderState(): Promise<Record<string, boolean>> {
  return safeGet<Record<string, boolean>>(FOLDERS_KEY, {});
}

export async function setFolderOpen(groupId: string, open: boolean): Promise<void> {
  const state = await loadFolderState();
  state[groupId] = open;
  await safeSet(FOLDERS_KEY, state);
}

// ---- Lesson progress -----------------------------------------------------

export interface LessonProgress {
  slidesViewed?: boolean;
  videoWatched?: boolean; // video ≥ 90%
  quizPassed?: boolean;
  updatedAt?: number;
}

const PROGRESS_KEY = 'progress';

export function loadProgress(): Promise<Record<string, LessonProgress>> {
  return safeGet<Record<string, LessonProgress>>(PROGRESS_KEY, {});
}

export async function loadLessonProgress(id: string): Promise<LessonProgress> {
  const all = await loadProgress();
  return all[id] ?? {};
}

export async function saveLessonProgress(
  id: string,
  patch: Partial<LessonProgress>,
): Promise<LessonProgress> {
  const all = await loadProgress();
  const next: LessonProgress = { ...all[id], ...patch, updatedAt: Date.now() };
  all[id] = next;
  await safeSet(PROGRESS_KEY, all);
  return next;
}

export function progressPercent(p: LessonProgress): number {
  const steps = [p.slidesViewed, p.videoWatched, p.quizPassed];
  const done = steps.filter(Boolean).length;
  return Math.round((done / steps.length) * 100);
}

// ---- Misc UI flags -------------------------------------------------------

const HELPER_DISMISSED_KEY = 'helperDismissed';

export function loadHelperDismissed(): Promise<boolean> {
  return safeGet<boolean>(HELPER_DISMISSED_KEY, false);
}

export function setHelperDismissed(v: boolean): Promise<void> {
  return safeSet(HELPER_DISMISSED_KEY, v);
}
