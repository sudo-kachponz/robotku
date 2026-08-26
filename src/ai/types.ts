// src/ai/types.ts
//
// Shared Computer Vision contract (PROMPT E). Kept dependency-free so it can be
// imported anywhere (blocks, sinks, panel) without pulling in any ML library.

/** One classification score. `score` is 0..1. */
export interface CvClassResult {
  label: string;
  score: number;
}

/** One detection. All geometry is NORMALISED 0..1; x/y are the box CENTER. */
export interface CvBox {
  label: string;
  score: number;
  x: number; // center x, 0..1 (0 = left edge)
  y: number; // center y, 0..1 (0 = top edge)
  w: number; // width, 0..1
  h: number; // height, 0..1
}

/** The result of running one frame through an engine. */
export interface CvFrameResult {
  at: number; // performance.now() when produced
  classes: CvClassResult[];
  boxes: CvBox[];
}

/** A loadable inference backend. Adapters live in src/ai/engines/*. */
export interface CvEngine {
  id: string;
  name: string;
  kind: 'classification' | 'detection';
  labels: string[];
  /** Load weights (lazy — heavy libs imported here, never at module top). */
  load(): Promise<void>;
  /** Run one frame. `source` is a <video>, <canvas> or <img>. */
  infer(source: CanvasImageSource): Promise<CvFrameResult>;
  /** Release GPU/wasm resources. */
  dispose(): void;
}

export const EMPTY_FRAME: CvFrameResult = { at: 0, classes: [], boxes: [] };
