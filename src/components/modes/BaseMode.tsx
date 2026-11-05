// src/components/modes/BaseMode.tsx
//
// Base Robot — simplified control layout:
// - Left: D-Pad for movement
// - Center: Robot display (static, centered)
// - Right: GRAB / RELEASE buttons
// - Bottom: keyboard shortcut guide

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import RobotSprite from './RobotSprite';
import { useDrive, useSettings } from '../../hooks/useDrive';
import { soundFx } from './JoystickAudio';
import styles from './BaseMode.module.css';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function BaseMode() {
  const { driveGroup, stopGroup, sendCommand } = useDrive();
  const { mapping } = useSettings();
  const { left, right } = mapping.base;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const robotRef = useRef<HTMLDivElement | null>(null);
  const leftStickThumbRef = useRef<HTMLDivElement | null>(null);

  const intentRef = useRef({ fwd: 0, turn: 0 });
  const headingRef = useRef(0);
  const reducedRef = useRef(false);

  // Speed level: 1 = Eco (50%), 2 = Normal (75%), 3 = Turbo (100%)
  const [speedLevel, setSpeedLevel] = useState<1 | 2 | 3>(2);
  const [intent, setIntent] = useState({ fwd: 0, turn: 0 });
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

  // ---- Action buttons ----
  const buzzer = useCallback(() => {
    sendCommand('PLAY_TONE', { hz: 880, ms: 250 });   // ring = buzzer
    soundFx.playHorn();
  }, [sendCommand]);

  // Grip buttons — no gripper functionality on the board yet, so these just give
  // feedback (placeholder). Wire to SET_GRIPPER when the hardware exists.
  const gripOpen = useCallback(() => soundFx.playClick(700), []);
  const gripClose = useCallback(() => soundFx.playClick(500), []);

  const stopWheels = useCallback(() => {
    stopGroup(left);
    stopGroup(right);
    setFwd(0);
    setTurn(0);
    soundFx.updateEngineSound(0, 0);
  }, [stopGroup, left, right, setFwd, setTurn]);

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

  // ---- Animation loop: rotate in place (no x/y movement) ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = robotRef.current;
      if (el && !reducedRef.current) {
        const { turn } = intentRef.current;
        headingRef.current = (headingRef.current + turn * 100 * dt + 360) % 360;
        el.style.transform = `rotate(${headingRef.current}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
          {/* ── 3-SECTION HORIZONTAL BODY ── */}
          <div className={styles.consoleBody}>
            {/* ── 1. LEFT SIDE: Analog Stick ── */}
            <div className={styles.leftJoyCon}>
              <div className={styles.railAccentLeft} />

              {/* Proportional Analog Stick */}
              <div
                className={styles.stickWell}
                onPointerDown={handleLeftStickStart}
                title="Stick: Drag untuk kendali gerak proporsional"
                aria-label="Thumbstick"
              >
                <div className={styles.stickThumb} ref={leftStickThumbRef}>
                  <div className={styles.stickRidge} />
                </div>
              </div>
            </div>

            {/* ── 2. CENTER DISPLAY ── */}
            <div className={styles.centerDisplay}>
              <div className={styles.screenTopBar}>
                <div className={styles.screenStatusBadges}>
                  <span className={styles.statusChip}>
                    GEAR: {speedLevel === 1 ? 'ECO 50%' : speedLevel === 2 ? 'NORM 75%' : 'TURBO 100%'}
                  </span>
                </div>
              </div>

              {/* Static Robot Display (centered, no movement) */}
              <div className={styles.switchScreen} ref={stageRef}>
                <div className={styles.arenaCrosshair} />
                <div className={styles.lcdRobot} ref={robotRef}>
                  <RobotSprite
                    fwd={intent.fwd}
                    turn={intent.turn}
                    gripperOpen={true}
                    reduced={reduced}
                  />
                </div>
              </div>
            </div>

            {/* ── 3. RIGHT SIDE: Action buttons (grip ×2 placeholder, buzzer) ── */}
            <div className={styles.rightJoyCon}>
              <div className={styles.railAccentRight} />

              <div className={styles.actionCluster}>
                <button
                  type="button"
                  className={`${styles.switchDpadBtn} ${styles.actBtn}`}
                  onClick={gripOpen}
                  aria-label="Buka grip"
                  title="Buka grip (belum ada fungsi)"
                >
                  ✋
                </button>
                <button
                  type="button"
                  className={`${styles.switchDpadBtn} ${styles.actBtn}`}
                  onClick={gripClose}
                  aria-label="Tutup grip"
                  title="Tutup grip (belum ada fungsi)"
                >
                  ✊
                </button>
                <button
                  type="button"
                  className={`${styles.switchDpadBtn} ${styles.actBtn} ${styles.actBtnBell}`}
                  onClick={buzzer}
                  aria-label="Buzzer"
                  title="Buzzer"
                >
                  🔔
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </ControlLayout>
  );
}

