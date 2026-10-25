// src/components/modes/BaseMode.tsx
//
// Base Robot — simplified control layout:
// - Left: D-Pad for movement
// - Center: Robot display (static, centered)
// - Right: GRAB / RELEASE buttons
// - Bottom: keyboard shortcut guide

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import HoldButton from './HoldButton';
import RobotSprite from './RobotSprite';
import { useDrive, useSettings } from '../../hooks/useDrive';
import { soundFx } from './JoystickAudio';
import styles from './BaseMode.module.css';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function BaseMode() {
  const { driveGroup, stopGroup, setGripper } = useDrive();
  const { mapping } = useSettings();
  const { left, right, arms } = mapping.base;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const leftStickThumbRef = useRef<HTMLDivElement | null>(null);

  const intentRef = useRef({ fwd: 0, turn: 0 });
  const reducedRef = useRef(false);

  // Speed level: 1 = Eco (50%), 2 = Normal (75%), 3 = Turbo (100%)
  const [speedLevel, setSpeedLevel] = useState<1 | 2 | 3>(2);
  const [intent, setIntent] = useState({ fwd: 0, turn: 0 });
  const [gripperOpen, setGripperOpen] = useState(true);
  const [reduced, setReduced] = useState(false);

  const currentDriveSpeed = speedLevel === 1 ? 50 : speedLevel === 2 ? 75 : 100;

  const setFwd = useCallback((v: number) => {
    intentRef.current.fwd = v;
    setIntent((i) => ({ ...i, fwd: v }));
    soundFx.updateEngineSound(v !== 0 ? 80 : 0, v !== 0 ? 80 : 0);
  }, []);

  const setTurn = useCallback((v: number) => {
    intentRef.current.turn = v;
    setIntent((i) => ({ ...i, turn: v }));
    soundFx.updateEngineSound(v !== 0 ? 60 : 0, v !== 0 ? -60 : 0);
  }, []);

  // ---- Transport intents (hardware behaviour) ----
  const forward = useCallback(() => {
    driveGroup(left, currentDriveSpeed);
    driveGroup(right, currentDriveSpeed);
    setFwd(1);
  }, [driveGroup, left, right, currentDriveSpeed, setFwd]);

  const backward = useCallback(() => {
    driveGroup(left, -currentDriveSpeed);
    driveGroup(right, -currentDriveSpeed);
    setFwd(-1);
  }, [driveGroup, left, right, currentDriveSpeed, setFwd]);

  const turnLeft = useCallback(() => {
    driveGroup(left, -currentDriveSpeed);
    driveGroup(right, currentDriveSpeed);
    setTurn(-1);
  }, [driveGroup, left, right, currentDriveSpeed, setTurn]);

  const turnRight = useCallback(() => {
    driveGroup(left, currentDriveSpeed);
    driveGroup(right, -currentDriveSpeed);
    setTurn(1);
  }, [driveGroup, left, right, currentDriveSpeed, setTurn]);

  const stopWheels = useCallback(() => {
    stopGroup(left);
    stopGroup(right);
    setFwd(0);
    setTurn(0);
    soundFx.updateEngineSound(0, 0);
  }, [stopGroup, left, right, setFwd, setTurn]);

  const grab = useCallback(() => {
    setGripper(false);
    driveGroup(arms, 100);
    setGripperOpen(false);
    soundFx.playClick(900);
  }, [setGripper, driveGroup, arms]);

  const release = useCallback(() => {
    setGripper(true);
    driveGroup(arms, -100);
    setGripperOpen(true);
    soundFx.playClick(600);
  }, [setGripper, driveGroup, arms]);

  const stopArms = useCallback(() => {
    stopGroup(arms);
  }, [stopGroup, arms]);

  // ---- Left Analog Stick Pointer Handlers (Proportional Steering/Drive) ----
  const handleLeftStickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      const maxR = rect.width / 2 - 12;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxR);
      const nx = Math.cos(angle) * (clampedDist / maxR);
      const ny = Math.sin(angle) * (clampedDist / maxR);

      if (leftStickThumbRef.current) {
        leftStickThumbRef.current.style.transform = `translate(${nx * maxR}px, ${ny * maxR}px)`;
      }

      const fwdVal = -ny;
      const turnVal = nx;
      intentRef.current = { fwd: fwdVal, turn: turnVal };
      setIntent({ fwd: fwdVal, turn: turnVal });

      const lPwr = clamp(Math.round((fwdVal + turnVal) * currentDriveSpeed), -100, 100);
      const rPwr = clamp(Math.round((fwdVal - turnVal) * currentDriveSpeed), -100, 100);
      driveGroup(left, lPwr);
      driveGroup(right, rPwr);
      soundFx.updateEngineSound(Math.abs(lPwr), Math.abs(rPwr));
    };

    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (leftStickThumbRef.current) {
        leftStickThumbRef.current.style.transform = `translate(0px, 0px)`;
      }
      stopWheels();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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

  // Global Keyboard shortcuts (gear speed only — 1/2/3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === '1') {
        setSpeedLevel(1);
        soundFx.playClick(500);
      } else if (e.key === '2') {
        setSpeedLevel(2);
        soundFx.playClick(750);
      } else if (e.key === '3') {
        setSpeedLevel(3);
        soundFx.playClick(1000);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ControlLayout title="Base Robot">
      <div className={styles.container}>
        {/* ── CONSOLE LAYOUT ── */}
        <div className={styles.switchConsole}>
          {/* ── TOP: GRAB / RELEASE shoulder buttons ── */}
          <div className={styles.shoulderBar}>
            <div className={styles.shoulderGroup}>
              <HoldButton
                className={`${styles.shoulderBtn} ${styles.triggerBtn}`}
                activeClassName={styles.shoulderActive}
                keys={['q', 'Q']}
                onStart={grab}
                onStop={stopArms}
                ariaLabel="Grab Claw (Q)"
                title="Grab Claw (Q)"
              >
                <ClawIcon closed />
                <span>GRAB</span>
              </HoldButton>
            </div>

            <div className={styles.shoulderGroup}>
              <HoldButton
                className={`${styles.shoulderBtn} ${styles.triggerBtn}`}
                activeClassName={styles.shoulderActive}
                keys={['e', 'E']}
                onStart={release}
                onStop={stopArms}
                ariaLabel="Release Claw (E)"
                title="Release Claw (E)"
              >
                <ClawIcon closed={false} />
                <span>RELEASE</span>
              </HoldButton>
            </div>
          </div>

          {/* ── 3-SECTION HORIZONTAL BODY ── */}
          <div className={styles.consoleBody}>
            {/* ── 1. LEFT SIDE: Analog Stick + D-Pad ── */}
            <div className={styles.leftJoyCon}>
              <div className={styles.railAccentLeft} />

              {/* Left Proportional Analog Stick */}
              <div
                className={styles.stickWell}
                onPointerDown={handleLeftStickStart}
                title="Left Stick: Drag untuk kendali gerak proporsional"
                aria-label="Left Thumbstick"
              >
                <div className={styles.stickThumb} ref={leftStickThumbRef}>
                  <div className={styles.stickRidge} />
                </div>
              </div>

              {/* 4-Way D-Pad Buttons */}
              <div className={styles.switchDpadGrid}>
                <HoldButton
                  className={`${styles.switchDpadBtn} ${styles.dpadUp}`}
                  activeClassName={styles.dpadActive}
                  keys={['w', 'W', 'ArrowUp']}
                  onStart={forward}
                  onStop={stopWheels}
                  ariaLabel="Maju (W / ↑)"
                  title="Maju (W / ↑)"
                >
                  <Arrow dir="up" />
                </HoldButton>

                <HoldButton
                  className={`${styles.switchDpadBtn} ${styles.dpadLeft}`}
                  activeClassName={styles.dpadActive}
                  keys={['a', 'A', 'ArrowLeft']}
                  onStart={turnLeft}
                  onStop={stopWheels}
                  ariaLabel="Belok Kiri (A / ←)"
                  title="Belok Kiri (A / ←)"
                >
                  <Arrow dir="left" />
                </HoldButton>

                <HoldButton
                  className={`${styles.switchDpadBtn} ${styles.dpadRight}`}
                  activeClassName={styles.dpadActive}
                  keys={['d', 'D', 'ArrowRight']}
                  onStart={turnRight}
                  onStop={stopWheels}
                  ariaLabel="Belok Kanan (D / →)"
                  title="Belok Kanan (D / →)"
                >
                  <Arrow dir="right" />
                </HoldButton>

                <HoldButton
                  className={`${styles.switchDpadBtn} ${styles.dpadDown}`}
                  activeClassName={styles.dpadActive}
                  keys={['s', 'S', 'ArrowDown']}
                  onStart={backward}
                  onStop={stopWheels}
                  ariaLabel="Mundur (S / ↓)"
                  title="Mundur (S / ↓)"
                >
                  <Arrow dir="down" />
                </HoldButton>
              </div>
            </div>

            {/* ── 2. CENTER DISPLAY ── */}
            <div className={styles.centerDisplay}>
              <div className={styles.screenTopBar}>
                <div className={styles.screenStatusBadges}>
                  <span className={styles.statusChip}>
                    GEAR: {speedLevel === 1 ? 'ECO 50%' : speedLevel === 2 ? 'NORM 75%' : 'TURBO 100%'}
                  </span>
                  <span className={`${styles.statusChip} ${styles.statusChipActive}`}>
                    {gripperOpen ? 'CLAW: OPEN' : 'CLAW: GRAB'}
                  </span>
                </div>
              </div>

              {/* Static Robot Display (centered, no movement) */}
              <div className={styles.switchScreen} ref={stageRef}>
                <div className={styles.arenaCrosshair} />
                <div className={styles.lcdRobot}>
                  <RobotSprite
                    fwd={intent.fwd}
                    turn={intent.turn}
                    gripperOpen={gripperOpen}
                    reduced={reduced}
                  />
                </div>
              </div>
            </div>

            {/* ── 3. RIGHT SIDE (empty — claw buttons moved to shoulder) ── */}
            <div className={styles.rightJoyCon}>
              <div className={styles.railAccentRight} />
            </div>
          </div>
        </div>

        {/* ── KEYBOARD SHORTCUT GUIDE ── */}
        <div className={styles.guideBar}>
          <div>
            <span className={styles.kbdBadge}>W / A / S / D</span> D-Pad Gerak
          </div>
          <div>
            <span className={styles.kbdBadge}>Q / E</span> Grab & Release
          </div>
          <div>
            <span className={styles.kbdBadge}>Spasi</span> Rem Stop
          </div>
          <div>
            <span className={styles.kbdBadge}>1 / 2 / 3</span> Gear Speed (Eco / Norm / Turbo)
          </div>
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
      width="14"
      height="14"
      fill="currentColor"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M12 4l-6 7h4v9h4v-9h4z" />
    </svg>
  );
}

function ClawIcon({ closed = false }: { closed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {closed ? (
        <>
          <path d="M7 6c2 4 4 6 5 6s3-2 5-6" />
          <path d="M12 12v7" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M5 6c1 5 4 6 7 6s6-1 7-6" />
          <path d="M12 12v7" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
