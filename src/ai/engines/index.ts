// src/ai/engines/index.ts — lazy factory: nothing loads until a model is chosen.

import type { CvEngine } from '../types';
import type { CvModelEntry } from '../registry';

export async function createEngine(entry: CvModelEntry): Promise<CvEngine> {
  switch (entry.engine) {
    case 'mediapipe':
      return new (await import('./mediapipeGesture')).MediapipeGestureEngine(entry);
    case 'tm':
      return new (await import('./teachableMachine')).TeachableMachineEngine(entry);
    case 'cocossd':
      return new (await import('./cocoSsd')).CocoSsdEngine(entry);
    case 'graph':
      return new (await import('./graphDetector')).GraphDetectorEngine(entry);
    default:
      throw new Error(`Unknown engine backend: ${(entry as CvModelEntry).engine}`);
  }
}
