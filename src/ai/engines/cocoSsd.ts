// src/ai/engines/cocoSsd.ts
//
// COCO-SSD detection adapter (@tensorflow-models/coco-ssd). Ships its own weights,
// so no local /models folder is needed. Boxes are normalised to 0..1 with a CENTER
// origin to match the CvBox contract. Lazy-imported.

import type { CvEngine, CvFrameResult, CvBox } from '../types';
import type { CvModelEntry } from '../registry';

function sourceSize(source: CanvasImageSource): { w: number; h: number } {
  const s = source as any;
  return {
    w: s.videoWidth || s.naturalWidth || s.width || 640,
    h: s.videoHeight || s.naturalHeight || s.height || 480,
  };
}

export class CocoSsdEngine implements CvEngine {
  id: string;
  name: string;
  kind = 'detection' as const;
  labels: string[] = [];
  private model: any = null;

  constructor(entry: CvModelEntry) {
    this.id = entry.id;
    this.name = entry.name;
    this.labels = entry.labels;
  }

  async load(): Promise<void> {
    await import('@tensorflow/tfjs');
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    this.model = await cocoSsd.load();
  }

  async infer(source: CanvasImageSource): Promise<CvFrameResult> {
    const at = performance.now();
    if (!this.model) return { at, classes: [], boxes: [] };
    try {
      const { w: W, h: H } = sourceSize(source);
      const preds: Array<{ bbox: [number, number, number, number]; class: string; score: number }> =
        await this.model.detect(source);
      const boxes: CvBox[] = preds.map((p) => {
        const [x, y, w, h] = p.bbox; // pixels, top-left origin
        return {
          label: p.class,
          score: Number(p.score) || 0,
          x: (x + w / 2) / W,
          y: (y + h / 2) / H,
          w: w / W,
          h: h / H,
        };
      });
      // Surface the labels actually present so the block dropdown can list them.
      this.labels = [...new Set(boxes.map((b) => b.label))];
      return { at, classes: [], boxes };
    } catch {
      return { at, classes: [], boxes: [] };
    }
  }

  dispose(): void {
    try { this.model?.dispose?.(); } catch { /* ignore */ }
    this.model = null;
  }
}
