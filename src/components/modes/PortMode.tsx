// src/components/modes/PortMode.tsx
//
// Port Control — 8 sliders (-100..100), live SET_PORT throttled ~20 Hz on change.
// Keybinds: Digit1..8 drive that port full; hold SHIFT to invert direction.

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import ConnectHint from './ConnectHint';
import { useDrive } from '../../hooks/useDrive';
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

  // Digit1..8 keybinds (SHIFT = invert).
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
      setValue(Number(m[1]), 0, true);
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
      <ConnectHint />
      <div className={styles.wrap}>
        <div className={styles.sectionTitle}>Uji tiap port (tekan 1–8, SHIFT untuk membalik)</div>
        <div className={styles.portGrid}>
          {Array.from({ length: 8 }, (_, i) => {
            const port = i + 1;
            const v = values[i];
            return (
              <div key={port} className={styles.portItem}>
                <span className={styles.portLabel}>Port {port}</span>
                <input
                  className={styles.portSlider}
                  type="range"
                  min={-100}
                  max={100}
                  value={v}
                  onChange={(e) => setValue(port, Number(e.target.value))}
                  onPointerUp={() => setValue(port, 0, true)}
                  onKeyUp={(e) => e.key === ' ' && setValue(port, 0, true)}
                />
                <span className={styles.portValue}>{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ControlLayout>
  );
}
