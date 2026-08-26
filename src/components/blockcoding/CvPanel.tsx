// src/components/blockcoding/CvPanel.tsx
//
// The Computer Vision panel (PROMPT E). Draggable card showing the live camera, a
// model picker, per-label confidence bars / detection boxes, and a threshold slider.
// Reads the cvStore singleton; frames never leave the device. Client-only — imported
// via next/dynamic({ssr:false}) from BlockCoding.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cvStore } from '../../ai/cvStore';
import { CV_MODELS, probeAll, registerModel, type CvModelEntry } from '../../ai/registry';
import styles from './CvPanel.module.css';

const TM_LINK = 'https://teachablemachine.withgoogle.com/train/image';

function prettify(label: string): string {
  return label.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CvPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useSyncExternalStore(cvStore.subscribe, cvStore.getState, cvStore.getState);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Probe which model folders exist (greys out the missing ones) on first open.
  useEffect(() => {
    if (open) void probeAll().then(() => cvStore.getState()); // triggers re-render via any later commit
  }, [open]);

  // Bind the live webcam stream to the preview <video>.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const stream = cvStore.getStream();
    if (state.source === 'webcam' && stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [state.status, state.source]);

  // Draw detection boxes on the overlay.
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (state.kind !== 'detection') return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22c55e';
    ctx.fillStyle = 'rgba(34,197,94,0.85)';
    ctx.font = '12px Plus Jakarta Sans, sans-serif';
    for (const b of state.boxes) {
      const x = (b.x - b.w / 2) * c.width;
      const y = (b.y - b.h / 2) * c.height;
      ctx.strokeRect(x, y, b.w * c.width, b.h * c.height);
      const tag = `${prettify(b.label)} ${Math.round(b.score * 100)}%`;
      ctx.fillRect(x, Math.max(0, y - 14), ctx.measureText(tag).width + 8, 14);
      ctx.fillStyle = '#fff';
      ctx.fillText(tag, x + 4, Math.max(10, y - 3));
      ctx.fillStyle = 'rgba(34,197,94,0.85)';
    }
  }, [state.boxes, state.kind]);

  // Stop the camera + tracks whenever the panel is closed/unmounted.
  useEffect(() => {
    if (!open) return;
    return () => cvStore.stop();
  }, [open]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [pos],
  );
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  }, []);
  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  const selectModel = useCallback((id: string) => {
    if (!cvStore.isOn()) void cvStore.startCamera();
    void cvStore.setModel(id);
  }, []);

  const loadFromUrl = useCallback(() => {
    const url = window.prompt('URL folder model (berisi model.json):');
    if (!url) return;
    const id = `custom_${Date.now()}`;
    const entry: CvModelEntry = {
      id,
      name: `Model URL (${id.slice(-4)})`,
      kind: 'classification',
      group: 'Classification',
      labels: [],
      modelUrl: url.replace(/\/?$/, '/'),
      engine: 'tm',
    };
    registerModel(entry);
    selectModel(id);
  }, [selectModel]);

  if (!open) return null;

  const classification = CV_MODELS.filter((m) => m.group === 'Classification');
  const detection = CV_MODELS.filter((m) => m.group === 'Detection');
  const live = state.status === 'live';
  const winner = state.topLabel;

  return (
    <div className={styles.card} style={{ right: 16 - pos.x, bottom: 16 - pos.y }}>
      <div
        className={styles.head}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className={`${styles.headDot} ${live ? styles.headDotLive : ''}`} />
        <h3>Computer Vision</h3>
        <button className={styles.headClose} onClick={onClose} aria-label="Tutup">
          ×
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.seg}>
          <button
            className={`${styles.segBtn} ${state.source === 'webcam' ? styles.segBtnOn : ''}`}
            onClick={() => cvStore.startCamera()}
          >
            Webcam
          </button>
          <button
            className={`${styles.segBtn} ${state.source === 'esp32' ? styles.segBtnOn : ''}`}
            onClick={() => cvStore.startEsp32()}
          >
            ESP32-Cam
          </button>
        </div>

        <select
          className={styles.select}
          value={state.modelId ?? ''}
          onChange={(e) => selectModel(e.target.value)}
        >
          <option value="" disabled>
            Select CV Model…
          </option>
          <optgroup label="Classification Models">
            {classification.map((m) => (
              <option key={m.id} value={m.id} disabled={m.unavailable}>
                {m.name}
                {m.unavailable ? ' (belum ada)' : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Detection Models">
            {detection.map((m) => (
              <option key={m.id} value={m.id} disabled={m.unavailable}>
                {m.name}
                {m.unavailable ? ' (belum ada)' : ''}
              </option>
            ))}
          </optgroup>
        </select>

        <div className={styles.preview}>
          <video ref={videoRef} className={styles.video} muted playsInline />
          <canvas ref={overlayRef} width={320} height={240} className={styles.overlay} />
          {!live && (
            <div className={styles.emptyState}>
              {state.status === 'denied'
                ? 'Enter learning element. Check permissions and try again.'
                : state.status === 'error'
                  ? (state.error ?? 'Kamera tidak tersedia.')
                  : 'Kamera mati. Pilih Webcam atau ESP32-Cam untuk mulai.'}
              <div>
                <button className={styles.btnSmall} onClick={() => cvStore.startCamera()}>
                  Nyalakan Kamera
                </button>
              </div>
            </div>
          )}
        </div>

        {state.error && live && <div className={styles.error}>{state.error}</div>}

        {state.kind === 'classification' && state.labels.length > 0 && (
          <div className={styles.bars}>
            {state.labels.map((label) => {
              const pct = cvStore.getConfidence(label);
              return (
                <div
                  key={label}
                  className={`${styles.bar} ${winner === label ? styles.barWin : ''}`}
                >
                  <span className={styles.barLabel}>{prettify(label)}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.barPct}>{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        <label className={styles.threshold}>
          Ambang {state.threshold}%
          <input
            type="range"
            min={0}
            max={100}
            value={state.threshold}
            onChange={(e) => cvStore.setThreshold(Number(e.target.value))}
          />
        </label>
      </div>

      <div className={styles.foot}>
        <div className={styles.footRow}>
          <a className={styles.link} href={TM_LINK} target="_blank" rel="noreferrer">
            Latih model sendiri ↗
          </a>
          <button className={styles.urlBtn} onClick={loadFromUrl}>
            Muat model dari URL
          </button>
        </div>
        <div className={styles.privacy}>
          Gambar diproses di perangkat ini — tidak pernah dikirim ke mana pun.
        </div>
      </div>
    </div>
  );
}
