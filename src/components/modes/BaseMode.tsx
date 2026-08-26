// src/components/modes/BaseMode.tsx
//
// Base Robot — robot stage + D-pad drive + Grab/Release. Uses the shared transport
// via useDrive and the Base port mapping from settings. Keybinds: W/↑ S/↓ A/← D/→,
// Grab Q, Release E.
//
// On top of the real transport commands, a lightweight kinematic simulation moves a
// 2D robot illustration (RobotSprite) so the picture follows the pressed buttons —
// forward drives along the current heading, left/right rotate in place, Grab/Release
// animate the claw. The simulation runs whether or not a device is connected.

import { useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import HoldButton from './HoldButton';
import RobotSprite from './RobotSprite';
import { useDrive, useSettings } from '../../hooks/useDrive';
import styles from '../../styles/ModeControls.module.css';

const DRIVE = 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function BaseMode() {
  const { driveGroup, stopGroup, setGripper } = useDrive();
  const { mapping } = useSettings();
  const { left, right, arms } = mapping.base;

  // ---- Simulation state ----
  const stageRef = useRef<HTMLDivElement | null>(null);
  const robotRef = useRef<HTMLDivElement | null>(null);
  const poseRef = useRef({ x: 0, y: 0, heading: 0 });
  const intentRef = useRef({ fwd: 0, turn: 0 });
  const reducedRef = useRef(false);

  // Drives the sprite's wheel spin / gripper pose (needs re-render).
  const [intent, setIntent] = useState({ fwd: 0, turn: 0 });
  const [gripperOpen, setGripperOpen] = useState(true);
  const [reduced, setReduced] = useState(false);

  const setFwd = (v: number) => {
    intentRef.current.fwd = v;
    setIntent((i) => ({ ...i, fwd: v }));
  };
  const setTurn = (v: number) => {
    intentRef.current.turn = v;
    setIntent((i) => ({ ...i, turn: v }));
  };

  // ---- Transport intents (unchanged hardware behaviour) ----
  const forward = () => {
    driveGroup(left, DRIVE);
    driveGroup(right, DRIVE);
    setFwd(1);
  };
  const backward = () => {
    driveGroup(left, -DRIVE);
    driveGroup(right, -DRIVE);
    setFwd(-1);
  };
  const turnLeft = () => {
    driveGroup(left, -DRIVE);
    driveGroup(right, DRIVE);
    setTurn(-1);
  };
  const turnRight = () => {
    driveGroup(left, DRIVE);
    driveGroup(right, -DRIVE);
    setTurn(1);
  };
  const stopWheels = () => {
    stopGroup(left);
    stopGroup(right);
    setFwd(0);
    setTurn(0);
  };

  const grab = () => {
    setGripper(false);
    driveGroup(arms, DRIVE);
    setGripperOpen(false);
  };
  const release = () => {
    setGripper(true);
    driveGroup(arms, -DRIVE);
    setGripperOpen(true);
  };
  const stopArms = () => stopGroup(arms);

  // ---- prefers-reduced-motion ----
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

  // ---- Animation loop: integrate intent → pose → transform ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = robotRef.current;
      const stage = stageRef.current;
      if (el && stage && !reducedRef.current) {
        const p = poseRef.current;
        const { fwd, turn } = intentRef.current;
        p.heading += turn * 90 * dt; // 90°/sec turn rate
        const r = (p.heading * Math.PI) / 180;
        p.x += Math.sin(r) * fwd * 150 * dt; // 150 px/sec along heading
        p.y -= Math.cos(r) * fwd * 150 * dt;
        const halfW = stage.clientWidth / 2;
        const halfH = stage.clientHeight / 2;
        p.x = clamp(p.x, -halfW * 0.42, halfW * 0.42);
        p.y = clamp(p.y, -halfH * 0.42, halfH * 0.42);
        el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.heading}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ControlLayout title="Base Robot">
      <div className={styles.baseWrap}>
        {/* ---- Robot stage ---- */}
        <div className={styles.stage} ref={stageRef}>
          <div className={styles.robot} ref={robotRef}>
            <RobotSprite
              fwd={intent.fwd}
              turn={intent.turn}
              gripperOpen={gripperOpen}
              reduced={reduced}
            />
          </div>
        </div>

        {/* ---- Control pad (3×3) ---- */}
        <div className={styles.pad}>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.padBtn} ${styles.gGrab}`}
            activeClassName={styles.ctrlActive}
            keys={['q', 'Q']}
            onStart={grab}
            onStop={stopArms}
            ariaLabel="Grab"
          >
            <span className={styles.padLabel}>Grab</span>
            <ClawIcon closed />
          </HoldButton>

          <HoldButton
            className={`${styles.ctrlBtn} ${styles.padBtn} ${styles.gUp}`}
            activeClassName={styles.ctrlActive}
            keys={['w', 'W', 'ArrowUp']}
            onStart={forward}
            onStop={stopWheels}
            ariaLabel="Maju"
          >
            <Arrow dir="up" />
          </HoldButton>

          <HoldButton
            className={`${styles.ctrlBtn} ${styles.padBtn} ${styles.gRelease}`}
            activeClassName={styles.ctrlActive}
            keys={['e', 'E']}
            onStart={release}
            onStop={stopArms}
            ariaLabel="Release"
          >
            <span className={styles.padLabel}>Release</span>
            <ClawIcon />
          </HoldButton>

          <HoldButton
            className={`${styles.ctrlBtn} ${styles.padBtn} ${styles.gLeft}`}
            activeClassName={styles.ctrlActive}
            keys={['a', 'A', 'ArrowLeft']}
            onStart={turnLeft}
            onStop={stopWheels}
            ariaLabel="Belok kiri"
          >
            <Arrow dir="left" />
          </HoldButton>

          <HoldButton
            className={`${styles.ctrlBtn} ${styles.padBtn} ${styles.gRight}`}
            activeClassName={styles.ctrlActive}
            keys={['d', 'D', 'ArrowRight']}
            onStart={turnRight}
            onStop={stopWheels}
            ariaLabel="Belok kanan"
          >
            <Arrow dir="right" />
          </HoldButton>

          <HoldButton
            className={`${styles.ctrlBtn} ${styles.padBtn} ${styles.gDown}`}
            activeClassName={styles.ctrlActive}
            keys={['s', 'S', 'ArrowDown']}
            onStart={backward}
            onStop={stopWheels}
            ariaLabel="Mundur"
          >
            <Arrow dir="down" />
          </HoldButton>
        </div>
      </div>
    </ControlLayout>
  );
}

function Arrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg
      viewBox="0 0 24 24"
      width="42"
      height="42"
      fill="currentColor"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M12 3l8 9h-5v9H9v-9H4z" />
    </svg>
  );
}

function ClawIcon({ closed = false }: { closed?: boolean }) {
  // Simple claw/hand glyph; `closed` pulls the pincers together for the Grab button.
  const spread = closed ? 3 : 7;
  return (
    <svg
      viewBox="0 0 40 40"
      width="38"
      height="38"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={`M${20 - spread} 8 L14 22 Q14 30 20 30 Q26 30 26 22 L${20 + spread} 8`} />
      <line x1="20" y1="30" x2="20" y2="36" />
      <circle cx="20" cy="22" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
