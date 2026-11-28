// src/components/modes/BaseMode.tsx
//
// Base Robot — big top-down illustration of the real kit on the left (BaseRobotArt:
// dowel frame, edge-on wheels on SG90 servos, Makerkit PCB, OLED, power bank) that
// leans the way you hold the buttons and springs back on release; 3x3 pad on the right:
//   · [▲] · / [◀] · [▶] / · [▼] [Buzzer]  (no claw on the kit: no Grab/Release)
// Highly responsive, landscape mobile optimized.

import { useCallback, useEffect, useState } from 'react';
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
  const [reduced, setReduced] = useState(false);
  const speed = 75; // fixed normal speed

  const drive = useCallback(
    (fwd: number, turn: number) => {
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

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setReduced(mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <ControlLayout title="Base Robot">
      <div className={styles.stage}>
        {/* Left: Robot illustration */}
        <div className={styles.robotArea}>
          {/* Like stickem: while a button is held the robot leans that way (nudges
              forward/back, tilts ±30° to turn) and springs back to the start pose on
              release — it doesn't roam the arena. */}
          <div
            className={styles.robotWrap}
            style={{
              transform: reduced
                ? undefined
                : `translateY(${-intent.fwd * 12}%) rotate(${intent.turn * 30}deg)`,
            }}
          >
            <BaseRobotArt fwd={intent.fwd} turn={intent.turn} reduced={reduced} link={link} />
          </div>
        </div>

        {/* Right: Controls */}
        <div className={styles.controls}>
          {/* Top row: Up */}
          <div className={styles.row}>
            <div className={styles.spacer} />
            <DpadBtn
              label="Maju"
              hideLabel
              icon={<ArrowUp />}
              onDown={() => onDpad(1, 0)}
              onUp={stop}
            />
            <div className={styles.spacer} />
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
