// src/ai/engines/teachableMachine.ts
//
// Teachable Machine image-classification adapter (@teachablemachine/image + tfjs).
// Loads model.json + metadata.json from the entry's folder. Lazy-imported.

import type { CvEngine, CvFrameResult } from '../types';
import type { CvModelEntry } from '../registry';

export class TeachableMachineEngine implements CvEngine {
  id: string;
  name: string;
  kind = 'classification' as const;
  labels: string[];
  private modelUrl: string;
  private model: any = null;

  constructor(entry: CvModelEntry) {
    this.id = entry.id;
    this.name = entry.name;
    this.labels = entry.labels;
    this.modelUrl = entry.modelUrl.replace(/\/?$/, '/');
  }

  async load(): Promise<void> {
    await import('@tensorflow/tfjs');
    const tmImage = await import('@teachablemachine/image');
    this.model = await tmImage.load(this.modelUrl + 'model.json', this.modelUrl + 'metadata.json');
    // Prefer the model's own labels once known.
    try {
      const labels = this.model.getClassLabels?.();
      if (Array.isArray(labels) && labels.length) this.labels = labels;
    } catch { /* keep registry labels */ }
  }

  async infer(source: CanvasImageSource): Promise<CvFrameResult> {
    const at = performance.now();
    if (!this.model) return { at, classes: [], boxes: [] };
    try {
      const preds: Array<{ className: string; probability: number }> = await this.model.predict(source);
      const classes = preds.map((p) => ({ label: p.className, score: Number(p.probability) || 0 }));
      return { at, classes, boxes: [] };
    } catch {
      return { at, classes: [], boxes: [] };
    }
  }

  dispose(): void {
    try { this.model?.dispose?.(); } catch { /* ignore */ }
    this.model = null;
  }
}
