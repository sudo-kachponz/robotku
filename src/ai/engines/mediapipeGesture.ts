// src/ai/engines/mediapipeGesture.ts
//
// MediaPipe GestureRecognizer adapter — the default engine for "Stop Go" so open
// palm / closed fist work WITHOUT a trained folder. Everything heavy is imported
// lazily inside load(); this module adds nothing to the main bundle.

import type { CvEngine, CvFrameResult } from '../types';
import type { CvModelEntry } from '../registry';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

// MediaPipe category names → our label ids.
const GESTURE_MAP: Record<string, string> = {
  Open_Palm: 'open_palm',
  Closed_Fist: 'closed_fist',
  Victory: 'victory',
  Thumb_Up: 'thumb_up',
  Thumb_Down: 'thumb_down',
  Pointing_Up: 'pointing_up',
  ILoveYou: 'i_love_you',
};

export class MediapipeGestureEngine implements CvEngine {
  id: string;
  name: string;
  kind = 'classification' as const;
  labels: string[];
  private recognizer: any = null;

  constructor(entry: CvModelEntry) {
    this.id = entry.id;
    this.name = entry.name;
    this.labels = entry.labels.length ? entry.labels : ['open_palm', 'closed_fist'];
  }

  async load(): Promise<void> {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
    this.recognizer = await vision.GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  }

  async infer(source: CanvasImageSource): Promise<CvFrameResult> {
    const at = performance.now();
    if (!this.recognizer) return { at, classes: [], boxes: [] };
    let result: any;
    try {
      result = this.recognizer.recognizeForVideo(source as HTMLVideoElement, at);
    } catch {
      return { at, classes: [], boxes: [] };
    }
    // Best gesture (if any) → a score for the matching label; the rest score 0.
    const top = result?.gestures?.[0]?.[0];
    const topLabel = top ? GESTURE_MAP[top.categoryName] ?? top.categoryName?.toLowerCase() : null;
    const classes = this.labels.map((label) => ({
      label,
      score: label === topLabel ? Number(top.score) || 0 : 0,
    }));
    return { at, classes, boxes: [] };
  }

  dispose(): void {
    try { this.recognizer?.close?.(); } catch { /* ignore */ }
    this.recognizer = null;
  }
}
