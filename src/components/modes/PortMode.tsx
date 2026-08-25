// src/components/modes/PortMode.tsx
//
// Port Control — LARGE board illustration (left) + 8 full-width horizontal
// sliders stacked vertically (right), each labeled 1–8 with Anticlockwise ·
// Neutral · Clockwise direction labels. Slider range -100 (anticlockwise) …
// 0 (neutral, center detent) … +100 (clockwise) with a center-out fill.
//
// Behaviour is unchanged: live SET_PORT throttled ~20 Hz on drag (forced send on
// release), release snaps back to Neutral/0 (continuous-rotation servo), and
// Digit1..8 drive that port full clockwise (hold SHIFT to invert → anticlockwise).
// When a port is being driven its S/V/G row on the board lights up.

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import { useDrive } from '../../hooks/useDrive';
import PortBoard, { fillBg } from './PortBoard';
import styles from '../../styles/ModeControls.module.css';

const THROTTLE_MS = 50; // ~20 Hz

export default function PortMode() {
  const { setPort } = useDrive();
  const [values, setValues] = useState<number[]>(() => Array(8).fill(0));
  const lastSent = useRef<number[]>(Array(8).fill(0));

  const sendThrottled = useCallback(
    (port: number, value: number) => {
      const now = performance.now();
      if (now - lastSent.current[port - 1] >= THROTTLE_MS) {
        lastSent.current[port - 1] = now;
        setPort(port, value);
      }
    },
    [setPort],
  );

  const setValue = useCallback(
    (port: number, value: number, force = false) => {
      setValues((prev) => {
        const next = [...prev];
        next[port - 1] = value;
        return next;
      });
      if (force) setPort(port, value);
      else sendThrottled(port, value);
    },
    [setPort, sendThrottled],
  );

  // Digit1..8 keybinds: drive full CLOCKWISE (+100); SHIFT = ANTICLOCKWISE (-100).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const m = /^Digit([1-8])$/.exec(e.code);
      if (!m || e.repeat) return;
      e.preventDefault();
      const port = Number(m[1]);
      setValue(port, e.shiftKey ? -100 : 100, true);
    };
    const up = (e: KeyboardEvent) => {
      const m = /^Digit([1-8])$/.exec(e.code);
      if (!m) return;
      e.preventDefault();
      setValue(Number(m[1]), 0, true); // release → Neutral
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setValue]);

  return (
    <ControlLayout title="Port Control">
      <div className={styles.portLayout}>
        {/* LEFT — board illustration (lights up the driven port row) */}
        <div className={styles.portBoardCol}>
          <PortBoard active={values.map((v) => v !== 0)} />
        </div>

        {/* RIGHT — 8 direction sliders */}
        <div className={styles.portRows}>
          <div className={styles.portHeader}>
            <span />
            <div className={styles.portHeaderLabels}>
              <span>Anticlockwise</span>
              <span>Neutral</span>
              <span>Clockwise</span>
            </div>
          </div>

          {Array.from({ length: 8 }, (_, i) => {
            const port = i + 1;
            const v = values[i];
            return (
              <div key={port} className={styles.portRow}>
                <span className={styles.portNum}>{port}</span>
                <div className={styles.portTrackWrap}>
                  <input
                    className={styles.portSlider}
                    type="range"
                    min={-100}
                    max={100}
                    value={v}
                    aria-label={`Port ${port} (kiri = anticlockwise, kanan = clockwise)`}
                    style={{ background: fillBg(v) }}
                    onChange={(e) => setValue(port, Number(e.target.value))}
                    onPointerUp={() => setValue(port, 0, true)}
                    onKeyUp={() => setValue(port, 0, true)}
                  />
                  <span className={styles.portDetent} aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ControlLayout>
  );
}
