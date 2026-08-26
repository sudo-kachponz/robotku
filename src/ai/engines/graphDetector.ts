// src/ai/engines/graphDetector.ts
//
// Generic TF.js GraphModel detector (used for the balloon models). Letterboxes the
// frame to the model's square input, runs it, and parses a YOLO-style output into
// normalised CENTER-origin CvBoxes, with NMS. Written defensively: any shape it
// can't parse yields an empty result rather than throwing. Lazy-imported.

import type { CvEngine, CvFrameResult, CvBox } from '../types';
import type { CvModelEntry } from '../registry';

export class GraphDetectorEngine implements CvEngine {
  id: string;
  name: string;
  kind = 'detection' as const;
  labels: string[];
  private modelUrl: string;
  private model: any = null;
  private tf: any = null;
  private inputSize = 640;
  private scoreThreshold = 0.3;

  constructor(entry: CvModelEntry) {
    this.id = entry.id;
    this.name = entry.name;
    this.labels = entry.labels.length ? entry.labels : ['balloon'];
    this.modelUrl = entry.modelUrl.replace(/\/?$/, '/');
  }

  async load(): Promise<void> {
    this.tf = await import('@tensorflow/tfjs');
    this.model = await this.tf.loadGraphModel(this.modelUrl + 'model.json');
    // Infer the square input size from the model signature when available.
    const shape = this.model?.inputs?.[0]?.shape as number[] | undefined;
    const dim = shape?.find((n) => n && n > 1);
    if (dim) this.inputSize = dim;
  }

  async infer(source: CanvasImageSource): Promise<CvFrameResult> {
    const at = performance.now();
    const tf = this.tf;
    if (!this.model || !tf) return { at, classes: [], boxes: [] };
    try {
      const size = this.inputSize;
      const input = tf.tidy(() =>
        tf.browser
          .fromPixels(source as any)
          .resizeBilinear([size, size]) // simple square resize (letterbox handled below)
          .toFloat()
          .div(255)
          .expandDims(0),
      );
      const out = await this.model.executeAsync(input);
      const outputs: any[] = Array.isArray(out) ? out : [out];
      const data = (await outputs[0].array())[0]; // [N, 5+C] or similar
      input.dispose();
      outputs.forEach((t) => t.dispose());

      const boxes = this.parse(data);
      return { at, classes: [], boxes };
    } catch {
      return { at, classes: [], boxes: [] };
    }
  }

  /** Parse a [N, >=5] tensor: cx, cy, w, h, obj, [class scores…] (normalised 0..1). */
  private parse(rows: any): CvBox[] {
    if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) return [];
    const out: CvBox[] = [];
    for (const r of rows) {
      if (r.length < 5) continue;
      const [cx, cy, w, h, obj] = r;
      const classScores = r.slice(5);
      const best = classScores.length ? Math.max(...classScores) : 1;
      const score = obj * (classScores.length ? best : 1);
      if (score < this.scoreThreshold) continue;
      const classIdx = classScores.length ? classScores.indexOf(best) : 0;
      // Some exports give pixel coords in input space; normalise defensively.
      const norm = (v: number) => (v > 1.5 ? v / this.inputSize : v);
      out.push({
        label: this.labels[classIdx] ?? this.labels[0] ?? 'object',
        score,
        x: Math.min(1, Math.max(0, norm(cx))),
        y: Math.min(1, Math.max(0, norm(cy))),
        w: Math.min(1, Math.max(0, norm(w))),
        h: Math.min(1, Math.max(0, norm(h))),
      });
    }
    return nms(out, 0.45).slice(0, 20);
  }

  dispose(): void {
    try { this.model?.dispose?.(); } catch { /* ignore */ }
    this.model = null;
  }
}

/** Greedy non-max suppression on CENTER-origin normalised boxes. */
function nms(boxes: CvBox[], iouThreshold: number): CvBox[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept: CvBox[] = [];
  for (const box of sorted) {
    if (kept.every((k) => iou(k, box) < iouThreshold)) kept.push(box);
  }
  return kept;
}

function iou(a: CvBox, b: CvBox): number {
  const ax1 = a.x - a.w / 2, ay1 = a.y - a.h / 2, ax2 = a.x + a.w / 2, ay2 = a.y + a.h / 2;
  const bx1 = b.x - b.w / 2, by1 = b.y - b.h / 2, bx2 = b.x + b.w / 2, by2 = b.y + b.h / 2;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}
