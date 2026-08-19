// src/components/modes/JoystickMode.tsx
//
// Joystick — one analog stick + two action buttons. Arcade mixing → left/right →
// SET_PORT on the configured Left/Right ports; stick axes also drive Custom Y/X
// ports if configured. Release → 0. Buttons → LED / gripper demo. Throttle ~20 Hz.

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import ConnectHint from './ConnectHint';
import { useDrive, useSettings } from '../../hooks/useDrive';
import styles from '../../styles/ModeControls.module.css';

const SEND_MS = 50; // ~20 Hz
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export default function JoystickMode() {
  const { driveGroup, setPort, setGripper, setLed } = useDrive();
  const { mapping } = useSettings();
  const { left, right, customX, customY } = mapping.joystick;

  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const targetRef = useRef({ l: 0, r: 0, x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [readout, setReadout] = useState({ l: 0, r: 0 });
  const [ledOn, setLedOn] = useState(false);
  const [gripOpen, setGripOpen] = useState(false);

  const setKnob = (dx: number, dy: number) => {
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const compute = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setKnob(dx, dy);
    const nx = clamp1(dx / radius);
    const ny = clamp1(-dy / radius); // up = forward
    const l = Math.round(clamp1(ny + nx) * 100);
    const r = Math.round(clamp1(ny - nx) * 100);
    targetRef.current = { l, r, x: Math.round(nx * 100), y: Math.round(ny * 100) };
    setReadout({ l, r });
  }, []);

  const startSending = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      const { l, r, x, y } = targetRef.current;
      driveGroup(left, l);
      driveGroup(right, r);
      if (customY.length) driveGroup(customY, y);
      if (customX.length) driveGroup(customX, x);
    }, SEND_MS);
  }, [driveGroup, left, right, customX, customY]);

  const stopSending = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const release = useCallback(() => {
    draggingRef.current = false;
    pointerIdRef.current = null;
    targetRef.current = { l: 0, r: 0, x: 0, y: 0 };
    setKnob(0, 0);
    setReadout({ l: 0, r: 0 });
    driveGroup(left, 0);
    driveGroup(right, 0);
    stopSending();
  }, [driveGroup, left, right, stopSending]);

  useEffect(() => () => stopSending(), [stopSending]);

  return (
    <ControlLayout title="Joystick">
      <ConnectHint />
      <div className={styles.wrap}>
        <div className={styles.joyStage}>
          <div
            ref={baseRef}
            className={styles.joyBase}
            onPointerDown={(e) => {
              draggingRef.current = true;
              pointerIdRef.current = e.pointerId;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              compute(e.clientX, e.clientY);
              startSending();
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current || e.pointerId !== pointerIdRef.current) return;
              compute(e.clientX, e.clientY);
            }}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <div ref={knobRef} className={styles.joyKnob} />
          </div>

          <div className={styles.joyActions}>
            <button
              className={`${styles.ctrlBtn} ${styles.joyAction}`}
              onClick={() => {
                const next = !ledOn;
                setLedOn(next);
                setLed(next ? '#EC2D8F' : '#000000');
              }}
            >
              💡 LED {ledOn ? 'ON' : 'OFF'}
            </button>
            <button
              className={`${styles.ctrlBtn} ${styles.joyAction}`}
              onClick={() => {
                const next = !gripOpen;
                setGripOpen(next);
                setGripper(next);
              }}
            >
              🦾 {gripOpen ? 'Open' : 'Close'}
            </button>
            <div className={styles.readout}>L {readout.l} · R {readout.r}</div>
          </div>
        </div>
      </div>
    </ControlLayout>
  );
}
