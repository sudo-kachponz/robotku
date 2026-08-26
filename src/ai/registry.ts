// src/ai/registry.ts
//
// The Computer Vision model catalogue (PROMPT E), grouped like the reference UI.
// A model folder that isn't present under /public/models/<id>/ is marked
// `unavailable` (greyed out) instead of throwing. The MediaPipe gesture model is
// the exception: it works out of the box (open palm / closed fist), so stop_go
// never depends on a local folder.

export type EngineKind = 'classification' | 'detection';
export type EngineBackend = 'tm' | 'cocossd' | 'graph' | 'mediapipe';

export interface CvModelEntry {
  id: string;
  name: string;
  kind: EngineKind;
  group: 'Classification' | 'Detection';
  labels: string[];
  /** Folder that holds model.json / metadata.json, served statically. */
  modelUrl: string;
  engine: EngineBackend;
  /** True once a probe confirms the model files are missing. */
  unavailable?: boolean;
}

export const CV_MODELS: CvModelEntry[] = [
  // --- Classification ---
  {
    id: 'stop_go',
    name: 'Stop Go (Open Palm & Close Fist)',
    kind: 'classification',
    group: 'Classification',
    labels: ['open_palm', 'closed_fist'],
    modelUrl: '/models/stop_go/',
    engine: 'mediapipe', // works without a trained folder
  },
  {
    id: 'face_mood',
    name: 'Smiling vs Frowning Face',
    kind: 'classification',
    group: 'Classification',
    labels: ['smiling', 'frowning'],
    modelUrl: '/models/face_mood/',
    engine: 'tm',
  },
  {
    id: 'rps',
    name: 'Scissors Paper Stone',
    kind: 'classification',
    group: 'Classification',
    labels: ['scissors', 'paper', 'stone'],
    modelUrl: '/models/rps/',
    engine: 'tm',
  },
  {
    id: 'red_car',
    name: 'Red Car Detector',
    kind: 'classification',
    group: 'Classification',
    labels: ['red_car', 'no_car'],
    modelUrl: '/models/red_car/',
    engine: 'tm',
  },
  // --- Detection ---
  {
    id: 'coco',
    name: 'Generic Object Detection (COCO)',
    kind: 'detection',
    group: 'Detection',
    labels: [], // coco-ssd exposes 80 labels at load time
    modelUrl: '/models/coco/',
    engine: 'cocossd', // bundled model URL, no local folder needed
  },
  {
    id: 'balloon',
    name: 'Balloon Detector',
    kind: 'detection',
    group: 'Detection',
    labels: ['balloon'],
    modelUrl: '/models/balloon/',
    engine: 'graph',
  },
  {
    id: 'balloon_esp32',
    name: 'Balloon Detector (ESP32Cam)',
    kind: 'detection',
    group: 'Detection',
    labels: ['balloon'],
    modelUrl: '/models/balloon_esp32/',
    engine: 'graph',
  },
];

/** Engines that ship their own weights and never need a local /models folder. */
const SELF_CONTAINED: EngineBackend[] = ['mediapipe', 'cocossd'];

export function getModel(id: string): CvModelEntry | undefined {
  return CV_MODELS.find((m) => m.id === id);
}

/** Register a model added at runtime ("Muat model dari URL"). */
export function registerModel(entry: CvModelEntry): void {
  const i = CV_MODELS.findIndex((m) => m.id === entry.id);
  if (i >= 0) CV_MODELS[i] = entry;
  else CV_MODELS.push(entry);
}

/**
 * Probe whether a model's files exist (HEAD on model.json), marking `unavailable`.
 * Self-contained engines are always available. Never throws — a network/blocked
 * fetch just leaves the entry as-is.
 */
export async function probeAvailability(entry: CvModelEntry): Promise<boolean> {
  if (SELF_CONTAINED.includes(entry.engine)) {
    entry.unavailable = false;
    return true;
  }
  try {
    const url = entry.modelUrl.replace(/\/?$/, '/') + 'model.json';
    const res = await fetch(url, { method: 'HEAD' });
    entry.unavailable = !res.ok;
    return res.ok;
  } catch {
    entry.unavailable = true;
    return false;
  }
}

export async function probeAll(): Promise<void> {
  await Promise.all(CV_MODELS.map((m) => probeAvailability(m).catch(() => {})));
}
