// src/ai/cvStore.ts
//
// The Computer Vision singleton: camera + throttled inference loop + external
// store. NOTHING heavy is imported at module top (engines/tfjs are loaded lazily
// via createEngine), so importing this into the runtime sinks costs almost nothing.
//
// Every getter returns a SAFE default (0 / null / false) when the camera is off, so
// an AI program still runs — the robot simply never sees anything. Frames never
// leave the device.

import type { CvEngine, CvFrameResult, CvBox } from './types';
import { EMPTY_FRAME } from './types';
import { getModel } from './registry';
import { createEngine } from './engines';

const ANY = 'any'; // the "apa saja" label
const SMOOTH_ALPHA = 0.6;
const FRAME_INTERVAL = 100; // ~10 fps

export type CameraSource = 'webcam' | 'esp32';
export type CvStatus = 'off' | 'starting' | 'live' | 'denied' | 'error';

export interface CvStoreState {
  status: CvStatus;
  source: CameraSource;
  error: string | null;
  modelId: string | null;
  modelName: string | null;
  kind: 'classification' | 'detection' | null;
  labels: string[];
  threshold: number; // 0..100
  smooth: Record<string, number>; // label -> smoothed score 0..1 (classification)
  boxes: CvBox[];
  topLabel: string | null;
  devices: Array<{ id: string; label: string }>;
  espUrl: string;
  fps: number;
}

function initialState(): CvStoreState {
  return {
    status: 'off',
    source: 'webcam',
    error: null,
    modelId: null,
    modelName: null,
    kind: null,
    labels: [],
    threshold: 60,
    smooth: {},
    boxes: [],
    topLabel: null,
    devices: [],
    espUrl: 'http://192.168.4.1:81/stream',
    fps: 0,
  };
}

class CvStore {
  private state: CvStoreState = initialState();
  private listeners = new Set<() => void>();

  private engine: CvEngine | null = null;
  private frame: CvFrameResult = EMPTY_FRAME;

  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private espImg: HTMLImageElement | null = null;
  private espCanvas: HTMLCanvasElement | null = null;

  private rafId = 0;
  private lastInfer = 0;
  private busy = false;
  private frameCount = 0;
  private fpsAt = 0;
  private modelToken = 0; // guards against a model swap mid-load

  // --- external store -------------------------------------------------------
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getState = (): CvStoreState => this.state;
  private commit(partial: Partial<CvStoreState>): void {
    this.state = { ...this.state, ...partial };
    for (const cb of this.listeners) cb();
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
  isOn(): boolean {
    return this.state.status === 'live' || this.state.status === 'starting';
  }

  // --- camera ---------------------------------------------------------------
  async listDevices(): Promise<void> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const devices = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Kamera ${i + 1}` }));
      this.commit({ devices });
    } catch {
      /* ignore — permissions not granted yet */
    }
  }

  async startCamera(deviceId?: string): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.commit({ status: 'error', error: 'Kamera tidak didukung di browser ini.' });
      return;
    }
    this.commit({ status: 'starting', source: 'webcam', error: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { width: 640, height: 480 },
        audio: false,
      });
      this.stream = stream;
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play().catch(() => {});
      this.video = video;
      this.commit({ status: 'live', source: 'webcam' });
      void this.listDevices();
      this.startLoop();
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
      this.commit({
        status: denied ? 'denied' : 'error',
        error: denied
          ? 'Izin kamera ditolak. Periksa izin lalu coba lagi.'
          : 'Kamera tidak ditemukan atau sedang dipakai aplikasi lain.',
      });
    }
  }

  /** ESP32-Cam MJPEG/JPEG source polled into an offscreen canvas. */
  startEsp32(url?: string): void {
    const espUrl = url ?? this.state.espUrl;
    this.commit({ status: 'starting', source: 'esp32', espUrl, error: null });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    this.espImg = img;
    this.espCanvas = canvas;
    img.onload = () => {
      if (this.state.status !== 'live') this.commit({ status: 'live', source: 'esp32' });
    };
    img.onerror = () =>
      this.commit({
        status: 'error',
        error: 'Tidak bisa membaca stream ESP32-Cam. Cek URL & jaringan.',
      });
    // Cache-bust so the browser fetches a fresh JPEG each tick.
    img.src = espUrl + (espUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    this.startLoop();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop(); // webcam LED off
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.espImg = null;
    this.espCanvas = null;
    this.frame = EMPTY_FRAME;
    this.commit({ status: 'off', boxes: [], smooth: {}, topLabel: null, fps: 0 });
  }

  // --- model ----------------------------------------------------------------
  async setModel(id: string): Promise<void> {
    const entry = getModel(id);
    if (!entry) return;
    const token = ++this.modelToken;
    // Dispose the previous engine.
    try {
      this.engine?.dispose();
    } catch {
      /* ignore */
    }
    this.engine = null;
    this.commit({
      modelId: id,
      modelName: entry.name,
      kind: entry.kind,
      labels: entry.labels,
      smooth: {},
      boxes: [],
    });
    try {
      const engine = await createEngine(entry);
      await engine.load();
      if (token !== this.modelToken) {
        engine.dispose();
        return;
      } // superseded
      this.engine = engine;
      this.commit({ labels: engine.labels, error: null });
    } catch {
      if (token === this.modelToken) this.commit({ error: `Gagal memuat model "${entry.name}".` });
    }
  }

  setThreshold(n: number): void {
    this.commit({ threshold: Math.min(100, Math.max(0, Math.round(n))) });
  }

  setEspUrl(url: string): void {
    this.commit({ espUrl: url });
  }

  // --- inference loop -------------------------------------------------------
  private startLoop(): void {
    if (this.rafId) return;
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      const now = performance.now();
      if (now - this.lastInfer < FRAME_INTERVAL) return;
      if (typeof document !== 'undefined' && document.hidden) return; // pause when tab hidden
      if (this.busy || !this.engine) return;
      const source = this.currentSource();
      if (!source) return;
      this.lastInfer = now;
      this.busy = true;
      this.engine
        .infer(source)
        .then((f) => this.ingest(f))
        .catch(() => {})
        .finally(() => {
          this.busy = false;
        });
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private currentSource(): CanvasImageSource | null {
    if (this.state.source === 'webcam') {
      return this.video && this.video.readyState >= 2 ? this.video : null;
    }
    // ESP32: draw the latest JPEG onto the canvas, then queue the next fetch.
    const img = this.espImg;
    const canvas = this.espCanvas;
    if (!img || !canvas || !img.complete || img.naturalWidth === 0) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = this.state.espUrl + (this.state.espUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    return canvas;
  }

  private ingest(frame: CvFrameResult): void {
    this.frame = frame;

    // Exponential smoothing on classification scores.
    const smooth = { ...this.state.smooth };
    for (const c of frame.classes) {
      const prev = smooth[c.label] ?? 0;
      smooth[c.label] = SMOOTH_ALPHA * c.score + (1 - SMOOTH_ALPHA) * prev;
    }

    // Top label across whichever modality is active.
    let topLabel: string | null = null;
    if (frame.classes.length) {
      topLabel = Object.entries(smooth).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    } else if (frame.boxes.length) {
      topLabel = [...frame.boxes].sort((a, b) => b.score - a.score)[0]?.label ?? null;
    }

    // fps meter.
    this.frameCount++;
    const now = performance.now();
    let fps = this.state.fps;
    if (now - this.fpsAt >= 1000) {
      fps = this.frameCount;
      this.frameCount = 0;
      this.fpsAt = now;
    }

    this.commit({ smooth, boxes: frame.boxes, topLabel, fps });
  }

  // --- reporters (safe defaults when off) -----------------------------------
  getConfidence(label: string): number {
    if (this.state.kind === 'detection') {
      const box = this.getBox(label);
      return box ? Math.round(box.score * 100) : 0;
    }
    if (label === ANY) {
      const top = Object.values(this.state.smooth).sort((a, b) => b - a)[0] ?? 0;
      return Math.round(top * 100);
    }
    return Math.round((this.state.smooth[label] ?? 0) * 100);
  }

  getBox(label: string): CvBox | null {
    const matches =
      label === ANY ? this.state.boxes : this.state.boxes.filter((b) => b.label === label);
    if (!matches.length) return null;
    return matches.reduce((best, b) => (b.score > best.score ? b : best));
  }

  isDetected(label: string, threshold?: number): boolean {
    const t = (threshold ?? this.state.threshold) / 100;
    if (this.state.kind === 'detection' || this.state.boxes.length) {
      const box = this.getBox(label);
      return !!box && box.score >= t;
    }
    if (label === ANY) return Object.values(this.state.smooth).some((s) => s >= t);
    return (this.state.smooth[label] ?? 0) >= t;
  }

  getObjectCount(label: string): number {
    if (!this.state.boxes.length) return 0;
    return label === ANY
      ? this.state.boxes.length
      : this.state.boxes.filter((b) => b.label === label).length;
  }

  getTopLabel(): string | null {
    return this.state.topLabel;
  }

  /** Single entry point the sinks use to answer a GET_AI_DATA request. */
  getAiValue(params: {
    metric?: string;
    label?: string;
    part?: string;
    threshold?: number;
  }): number | null {
    const label = params.label || ANY;
    switch (params.metric) {
      case 'confidence':
        return this.getConfidence(label);
      case 'detected':
        return this.isDetected(label, params.threshold) ? 1 : 0;
      case 'count':
        return this.getObjectCount(label);
      case 'bbox': {
        const box = this.getBox(label);
        if (!box) return 0;
        const v =
          params.part === 'y'
            ? box.y
            : params.part === 'w'
              ? box.w
              : params.part === 'h'
                ? box.h
                : box.x;
        return Math.round(v * 100);
      }
      default:
        return null;
    }
  }
}

export const cvStore = new CvStore();
