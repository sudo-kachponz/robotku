// src/components/modes/BaseMode.tsx
//
// Base Robot — big top-down illustration of the real kit on the left (BaseRobotArt:
// dowel frame, edge-on wheels on SG90 servos, Makerkit PCB, OLED, power bank) that
// drives around as you hold the buttons; 3x3 pad on the right:
//   [Grab] [▲] [Release] / [◀] · [▶] / · [▼] [Buzzer]
// Highly responsive, landscape mobile optimized.

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import BaseRobotArt from './BaseRobotArt';
import { useDrive, useSettings } from '../../hooks/useDrive';
import { useConnection } from '../../hooks/useConnection';
import { soundFx } from './JoystickAudio';
import { getState } from '../../app/store';
import styles from './BaseMode.module.css';

export default function BaseMode() {
  const { driveGroup, stopGroup, sendCommand } = useDrive();
  const { mapping } = useSettings();
  const { left, right } = mapping.base;
  const { transport, connState } = useConnection();
  const link = connState === 'connected' ? (transport?.kind ?? null) : null;

  const [intent, setIntent] = useState({ fwd: 0, turn: 0 });
  const intentRef = useRef({ fwd: 0, turn: 0 });
  const headingRef = useRef(0);
  const poseRef = useRef({ x: 0, y: 0 });
  const robotRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const reducedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  const speed = 75; // fixed normal speed

  const drive = useCallback(
    (fwd: number, turn: number) => {
      intentRef.current = { fwd, turn };
      setIntent({ fwd, turn });
      const l = Math.round((fwd + turn) * speed);
      const r = Math.round((fwd - turn) * speed);
      driveGroup(left, Math.max(-100, Math.min(100, l)));
      driveGroup(right, Math.max(-100, Math.min(100, r)));
      soundFx.updateEngineSound(Math.abs(l), Math.abs(r));
    },
    [driveGroup],
  );

  const stop = useCallback(() => {
    intentRef.current = { fwd: 0, turn: 0 };
    setIntent({ fwd: 0, turn: 0 });
    stopGroup(left);
    stopGroup(right);
    soundFx.updateEngineSound(0, 0);
  }, [stopGroup]);

  // D-pad handlers — hold to drive, release to stop
  const onDpad = useCallback(
    (fwd: number, turn: number) => {
      drive(fwd, turn);
      soundFx.playClick(600);
    },
    [drive],
  );

  const buzzer = useCallback(() => {
    // `target: 'buzzer'` = the physical buzzer on the board (Makerkit routes plain
    // PLAY_TONE to the I2S speaker). `frequency` is the name firmware reads; `hz`
    // was silently ignored (always 440 Hz).
    sendCommand('PLAY_TONE', { frequency: 880, duration_ms: 250, target: 'buzzer' });
    // Laptop horn only as simulator feedback. With a robot connected it made the
    // buzzer "sound from the laptop" and hid whether the hardware really beeped.
    if (!getState().transport) soundFx.playHorn();
  }, [sendCommand]);

  const gripOpen = useCallback(() => soundFx.playClick(700), []);
  const gripClose = useCallback(() => soundFx.playClick(500), []);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Animation loop: robot drives around the arena
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = robotRef.current;
      const arena = arenaRef.current;
      if (el && arena && !reducedRef.current) {
        const { fwd, turn } = intentRef.current;
        headingRef.current = (headingRef.current + turn * 120 * dt + 360) % 360;
        const rad = (headingRef.current * Math.PI) / 180;
        const pose = poseRef.current;
        pose.x += Math.sin(rad) * fwd * 140 * dt;
        pose.y -= Math.cos(rad) * fwd * 140 * dt;
        // Keep the whole (big) robot inside the arena, not just a 120px box.
        const halfW = Math.max(0, (arena.clientWidth - el.offsetWidth) / 2);
        const halfH = Math.max(0, (arena.clientHeight - el.offsetHeight) / 2);
        pose.x = clamp(pose.x, -halfW, halfW);
        pose.y = clamp(pose.y, -halfH, halfH);
        el.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${headingRef.current}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ControlLayout title="Base Robot">
      <div className={styles.stage}>
        {/* Left: Robot illustration */}
        <div className={styles.robotArea} ref={arenaRef}>
          <div className={styles.robotWrap} ref={robotRef}>
            <BaseRobotArt fwd={intent.fwd} turn={intent.turn} reduced={reduced} link={link} />
          </div>
        </div>

        {/* Right: Controls */}
        <div className={styles.controls}>
          {/* Top row: Grab - Up - Release */}
          <div className={styles.row}>
            <DpadBtn
              label="Grab"
              icon={<GrabIcon />}
              onDown={gripOpen}
              className={styles.actionBtn}
            />
            <DpadBtn
              label="Maju"
              hideLabel
              icon={<ArrowUp />}
              onDown={() => onDpad(1, 0)}
              onUp={stop}
            />
            <DpadBtn
              label="Release"
              icon={<ReleaseIcon />}
              onDown={gripClose}
              className={styles.actionBtn}
            />
          </div>

          {/* Middle row: Left - (empty) - Right */}
          <div className={styles.row}>
            <DpadBtn
              label="Kiri"
              hideLabel
              icon={<ArrowLeft />}
              onDown={() => onDpad(0, -1)}
              onUp={stop}
            />
            <div className={styles.spacer} />
            <DpadBtn
              label="Kanan"
              hideLabel
              icon={<ArrowRight />}
              onDown={() => onDpad(0, 1)}
              onUp={stop}
            />
          </div>

          {/* Bottom row: (empty) - Down - Buzzer */}
          <div className={styles.row}>
            <div className={styles.spacer} />
            <DpadBtn
              label="Mundur"
              hideLabel
              icon={<ArrowDown />}
              onDown={() => onDpad(-1, 0)}
              onUp={stop}
            />
            <DpadBtn
              label="Buzzer"
              icon={<BuzzerIcon />}
              onDown={buzzer}
              className={styles.buzzerBtn}
            />
          </div>
        </div>
      </div>
    </ControlLayout>
  );
}

/* ---- D-Pad Button Component ---- */
function DpadBtn({
  label,
  icon,
  onDown,
  onUp,
  className,
  hideLabel,
}: {
  label: string;
  icon: React.ReactNode;
  onDown: () => void;
  onUp?: () => void;
  className?: string;
  /** Arrows show only the icon; the label stays as aria-label/title. */
  hideLabel?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.dpadBtn} ${className ?? ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-label={label}
      title={label}
    >
      {!hideLabel && <span className={styles.btnLabel}>{label}</span>}
      {icon}
    </button>
  );
}

/* ---- Icons ---- */
// Big solid triangles, like the reference pad.
function Tri({ rotate }: { rotate: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.arrow}
      style={{ transform: `rotate(${rotate}deg)` }}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 5.5 L21 18.5 H3 Z" />
    </svg>
  );
}
const ArrowUp = () => <Tri rotate={0} />;
const ArrowRight = () => <Tri rotate={90} />;
const ArrowDown = () => <Tri rotate={180} />;
const ArrowLeft = () => <Tri rotate={270} />;
function GrabIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.handIcon} fill="currentColor" aria-hidden="true">
      <path d="M6.5 10c-.3 0-.5-.2-.5-.5v-5c0-1.1.9-2 2-2s2 .9 2 2v3h1V3.5c0-1.1.9-2 2-2s2 .9 2 2V7h1V4.5c0-1.1.9-2 2-2s2 .9 2 2v6c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-6c0-.6-.4-1-1-1s-1 .4-1 1V7.5c0 .3-.2.5-.5.5S14 7.8 14 7.5v-4c0-.6-.4-1-1-1s-1 .4-1 1v5c0 .3-.2.5-.5.5S11 9.8 11 9.5v-5c0-.6-.4-1-1-1s-1 .4-1 1v5c0 .3-.2.5-.5.5S8 9.8 8 9.5V6.3c-.6.3-1.5.6-1.5 3.2 0 .3-.2.5-.5.5zm10 12H9c-2.2 0-4-1.8-4-4v-5.5c0-1.1.9-2 2-2s2 .9 2 2V14c0 .3.2.5.5.5s.5-.2.5-.5v-3.5c0-1.1.9-2 2-2s2 .9 2 2V14c0 .3.2.5.5.5s.5-.2.5-.5v-2.5c0-1.1.9-2 2-2s2 .9 2 2V18c0 2.2-1.8 4-4 4z" />
    </svg>
  );
}
function ReleaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.handIcon} fill="currentColor" aria-hidden="true">
      <path d="M18 11V4.5c0-1.1-.9-2-2-2s-2 .9-2 2V9h-1V3.5c0-1.1-.9-2-2-2s-2 .9-2 2V9H8V4.5c0-1.1-.9-2-2-2s-2 .9-2 2V14c0 4.4 3.6 8 8 8s8-3.6 8-8v-3z" />
    </svg>
  );
}
function BuzzerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.handIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
    </svg>
  );
}
