// src/components/modes/BaseMode.tsx
//
// Base Robot — Nintendo Switch Landscape Console Experience:
// - Left Neon Blue Joy-Con: ZL (Grab), L (Gear/Speed), Minus (Reset), Interactive Left Analog Stick, D-Pad, Capture (Mute)
// - Center 16:9 HD Display: Live 2D Kinematic Virtual Arena simulation, RobotSprite, breadcrumb trail, cyber HUD telemetry
// - Right Neon Red Joy-Con: ZR (Release), R (Turbo), Plus (Horn), ABXY Diamond Cluster, Interactive Right Analog Stick, Home Button

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import HoldButton from './HoldButton';
import RobotSprite from './RobotSprite';
import { useDrive, useSettings } from '../../hooks/useDrive';
import { soundFx } from './JoystickAudio';
import styles from './BaseMode.module.css';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function BaseMode() {
  const { driveGroup, stopGroup, setGripper, sendCommand } = useDrive();
  const { mapping } = useSettings();
  const { left, right, arms } = mapping.base;

  // ---- Simulation state ----
  const stageRef = useRef<HTMLDivElement | null>(null);
  const robotRef = useRef<HTMLDivElement | null>(null);
  const leftStickThumbRef = useRef<HTMLDivElement | null>(null);
  const rightStickThumbRef = useRef<HTMLDivElement | null>(null);

  const poseRef = useRef({ x: 0, y: 0, heading: 0 });
  const intentRef = useRef({ fwd: 0, turn: 0 });
  const reducedRef = useRef(false);

  // Speed level: 1 = Eco (50%), 2 = Normal (75%), 3 = Turbo (100%)
  const [speedLevel, setSpeedLevel] = useState<1 | 2 | 3>(2);
  const [intent, setIntent] = useState({ fwd: 0, turn: 0 });
  const [gripperOpen, setGripperOpen] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [telemetry, setTelemetry] = useState({ heading: 0, speed: 0, x: 0, y: 0 });
  const [trail, setTrail] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const trailCounter = useRef(0);

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

  const resetPosition = useCallback(() => {
    poseRef.current = { x: 0, y: 0, heading: 0 };
    setTrail([]);
    if (robotRef.current) {
      robotRef.current.style.transform = `translate(0px, 0px) rotate(0deg)`;
    }
    soundFx.playClick(750);
  }, []);

  const triggerHorn = useCallback(() => {
    soundFx.playHorn();
    sendCommand('PLAY_TONE', { hz: 880, ms: 200 });
  }, [sendCommand]);

  const toggleSound = useCallback(() => {
    const next = !soundMuted;
    setSoundMuted(next);
    soundFx.setMuted(next);
    if (!next) soundFx.playClick(800);
  }, [soundMuted]);

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

      // Proportional drive
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

  // ---- Right Analog Stick Pointer Handlers (Quick Stunt & Pivot) ----
  const handleRightStickStart = (e: React.PointerEvent<HTMLDivElement>) => {
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

      if (rightStickThumbRef.current) {
        rightStickThumbRef.current.style.transform = `translate(${nx * maxR}px, ${ny * maxR}px)`;
      }

      // If pushed sideways -> rapid pivot turn stunt
      if (Math.abs(nx) > 0.4) {
        const sign = Math.sign(nx);
        driveGroup(left, sign * 100);
        driveGroup(right, -sign * 100);
        setTurn(sign * 1.5);
      } else if (ny < -0.4) {
        // Pushed up -> Turbo forward stunt
        driveGroup(left, 100);
        driveGroup(right, 100);
        setFwd(1.5);
      }
    };

    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rightStickThumbRef.current) {
        rightStickThumbRef.current.style.transform = `translate(0px, 0px)`;
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

  // ---- Animation loop: integrate intent → pose → transform ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let trailTimer = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = robotRef.current;
      const stage = stageRef.current;
      if (el && stage && !reducedRef.current) {
        const p = poseRef.current;
        const { fwd, turn } = intentRef.current;
        p.heading = (p.heading + turn * 100 * dt + 360) % 360;
        const r = (p.heading * Math.PI) / 180;
        p.x += Math.sin(r) * fwd * 150 * dt;
        p.y -= Math.cos(r) * fwd * 150 * dt;
        const halfW = stage.clientWidth / 2;
        const halfH = stage.clientHeight / 2;
        p.x = clamp(p.x, -halfW * 0.44, halfW * 0.44);
        p.y = clamp(p.y, -halfH * 0.44, halfH * 0.44);
        el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.heading}deg)`;

        // Update trail dots when moving
        trailTimer += dt;
        if (trailTimer > 0.15 && (fwd !== 0 || turn !== 0)) {
          trailTimer = 0;
          setTrail((prev) => [
            ...prev.slice(-14),
            { id: trailCounter.current++, x: p.x, y: p.y },
          ]);
        }

        setTelemetry({
          heading: Math.round(p.heading),
          speed: fwd !== 0 ? Math.round(Math.abs(fwd) * currentDriveSpeed) : turn !== 0 ? Math.round(Math.abs(turn) * 75) : 0,
          x: Math.round(p.x),
          y: Math.round(p.y),
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentDriveSpeed]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'm' || e.key === 'M') {
        toggleSound();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'Backspace') {
        resetPosition();
      } else if (e.key === '1') {
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
  }, [toggleSound, resetPosition]);

  return (
    <ControlLayout title="Base Robot">
      <div className={styles.container}>
        {/* ── NINTENDO SWITCH HORIZONTAL CONSOLE ── */}
        <div className={styles.switchConsole}>
          {/* ── TOP SHOULDER TRIGGERS & BUMPERS ── */}
          <div className={styles.shoulderBar}>
            {/* Left Joy-Con Shoulder Triggers (ZL & L) */}
            <div className={styles.shoulderGroup}>
              <HoldButton
                className={`${styles.shoulderBtn} ${styles.triggerBtn}`}
                activeClassName={styles.shoulderActive}
                keys={['q', 'Q']}
                onStart={grab}
                onStop={stopArms}
                ariaLabel="ZL: Grab Claw (Q)"
                title="ZL Trigger: Grab Claw (Q)"
              >
                <ClawIcon closed />
                <span>ZL (GRAB)</span>
              </HoldButton>

              <button
                className={styles.shoulderBtn}
                onClick={() => {
                  setSpeedLevel(speedLevel === 1 ? 2 : 1);
                  soundFx.playClick(600);
                }}
                title="L Bumper: Ganti Kecepatan (1 / 2)"
                aria-label="L: Speed Mode"
              >
                <span>L ({speedLevel === 1 ? 'ECO' : 'NORM'})</span>
              </button>
            </div>

            {/* Right Joy-Con Shoulder Triggers (R & ZR) */}
            <div className={styles.shoulderGroup}>
              <button
                className={styles.shoulderBtn}
                onClick={() => {
                  setSpeedLevel(speedLevel === 3 ? 2 : 3);
                  soundFx.playClick(900);
                }}
                title="R Bumper: Turbo Boost Mode (3)"
                aria-label="R: Turbo Mode"
              >
                <ZapIcon />
                <span>R ({speedLevel === 3 ? 'TURBO ON' : 'TURBO'})</span>
              </button>

              <HoldButton
                className={`${styles.shoulderBtn} ${styles.triggerBtn}`}
                activeClassName={styles.shoulderActive}
                keys={['e', 'E']}
                onStart={release}
                onStop={stopArms}
                ariaLabel="ZR: Release Claw (E)"
                title="ZR Trigger: Release Claw (E)"
              >
                <ClawIcon closed={false} />
                <span>ZR (RELEASE)</span>
              </HoldButton>
            </div>
          </div>

          {/* ── 3-SECTION HORIZONTAL BODY ── */}
          <div className={styles.consoleBody}>
            {/* ── 1. LEFT JOY-CON (NEON BLUE) ── */}
            <div className={styles.leftJoyCon}>
              <div className={styles.railAccentLeft} />

              {/* Minus (-) Button */}
              <div className={`${styles.joyconTopMeta} ${styles.joyconTopMetaLeft}`}>
                <button
                  className={styles.minusBtn}
                  onClick={resetPosition}
                  title="Minus (-): Reset Posisi & Kalibrasi (R)"
                  aria-label="Minus: Reset Posisi"
                >
                  −
                </button>
              </div>

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

              {/* 4-Way D-Pad Buttons (Switch Style) */}
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

              {/* Capture Button & Player Indicator */}
              <div className={styles.joyconBottomMeta}>
                <button
                  className={styles.captureBtn}
                  onClick={toggleSound}
                  title={`Capture Button: ${soundMuted ? 'Unmute' : 'Mute'} Audio FX (M)`}
                  aria-label="Capture: Toggle Audio FX"
                >
                  <MuteIcon muted={soundMuted} />
                </button>

                <div className={styles.playerLeds}>
                  <div className={styles.playerLedDot} />
                  <div className={styles.playerLedDotDim} />
                  <div className={styles.playerLedDotDim} />
                  <div className={styles.playerLedDotDim} />
                </div>
              </div>
            </div>

            {/* ── 2. CENTER HD WIDESCREEN DISPLAY ── */}
            <div className={styles.centerDisplay}>
              {/* Screen Top Bezel Bar */}
              <div className={styles.screenTopBar}>
                <div className={styles.screenLogo}>
                  <div className={styles.screenLogoDotCyan} />
                  <span>NINTENDO ROBOT ARENA</span>
                  <div className={styles.screenLogoDotRed} />
                </div>

                <div className={styles.screenStatusBadges}>
                  <span className={styles.statusChip}>
                    GEAR: {speedLevel === 1 ? 'ECO 50%' : speedLevel === 2 ? 'NORM 75%' : 'TURBO 100%'}
                  </span>
                  <span className={`${styles.statusChip} ${styles.statusChipActive}`}>
                    {gripperOpen ? 'CLAW: OPEN' : 'CLAW: GRAB'}
                  </span>
                </div>
              </div>

              {/* 2D Virtual Arena Canvas */}
              <div className={styles.switchScreen} ref={stageRef}>
                <div className={styles.arenaCrosshair} />

                {/* Trail breadcrumbs */}
                {trail.map((t) => (
                  <div
                    key={t.id}
                    className={styles.arenaTrailDot}
                    style={{
                      transform: `translate(${t.x}px, ${t.y}px)`,
                    }}
                  />
                ))}

                <div className={styles.lcdRobot} ref={robotRef}>
                  <RobotSprite
                    fwd={intent.fwd}
                    turn={intent.turn}
                    gripperOpen={gripperOpen}
                    reduced={reduced}
                  />
                </div>
              </div>

              {/* Screen Bottom Telemetry & Quick Action Bar */}
              <div className={styles.screenHudBottom}>
                <div className={styles.hudTelemetryRow}>
                  <span>X: {telemetry.x}px</span>
                  <span>Y: {telemetry.y}px</span>
                  <span>θ: {telemetry.heading}°</span>
                  <span>SPD: {telemetry.speed}%</span>
                </div>

                <div className={styles.hudQuickActions}>
                  <button
                    className={styles.hudActionBtn}
                    onClick={resetPosition}
                    title="Reset Posisi Robot (R)"
                  >
                    Reset Posisi
                  </button>
                  <button
                    className={styles.hudActionBtn}
                    onClick={triggerHorn}
                    title="Bunyikan Klakson (H)"
                  >
                    Klakson
                  </button>
                </div>
              </div>
            </div>

            {/* ── 3. RIGHT JOY-CON (NEON RED) ── */}
            <div className={styles.rightJoyCon}>
              <div className={styles.railAccentRight} />

              {/* Plus (+) Button */}
              <div className={styles.joyconTopMeta}>
                <button
                  className={styles.plusBtn}
                  onClick={triggerHorn}
                  title="Plus (+): Bunyikan Klakson Horn (H)"
                  aria-label="Plus: Klakson"
                >
                  +
                </button>
              </div>

              {/* ABXY Diamond Buttons (Switch Style) */}
              <div className={styles.switchAbxyGrid}>
                {/* X Button (Top): Horn Klakson (H) */}
                <HoldButton
                  className={`${styles.switchAbxyBtn} ${styles.abxyX}`}
                  activeClassName={styles.abxyActive}
                  keys={['h', 'H']}
                  onStart={triggerHorn}
                  onStop={() => {}}
                  ariaLabel="X: Klakson (H)"
                  title="X Button: Klakson Horn (H)"
                >
                  <span>X</span>
                </HoldButton>

                {/* Y Button (Left): Grab Claw (Q) */}
                <HoldButton
                  className={`${styles.switchAbxyBtn} ${styles.abxyY}`}
                  activeClassName={styles.abxyActive}
                  keys={['q', 'Q']}
                  onStart={grab}
                  onStop={stopArms}
                  ariaLabel="Y: Grab Claw (Q)"
                  title="Y Button: Grab Claw (Q)"
                >
                  <span>Y</span>
                </HoldButton>

                {/* A Button (Right): Release Claw (E) */}
                <HoldButton
                  className={`${styles.switchAbxyBtn} ${styles.abxyA}`}
                  activeClassName={styles.abxyActive}
                  keys={['e', 'E']}
                  onStart={release}
                  onStop={stopArms}
                  ariaLabel="A: Release Claw (E)"
                  title="A Button: Release Claw (E)"
                >
                  <span>A</span>
                </HoldButton>

                {/* B Button (Bottom): Emergency Brake Stop (Space / Escape) */}
                <HoldButton
                  className={`${styles.switchAbxyBtn} ${styles.abxyB}`}
                  activeClassName={styles.abxyActive}
                  keys={[' ', 'Escape']}
                  onStart={stopWheels}
                  onStop={() => {}}
                  ariaLabel="B: Rem / Stop (Spasi / Esc)"
                  title="B Button: Rem & Berhenti (Spasi / Esc)"
                >
                  <span>B</span>
                </HoldButton>
              </div>

              {/* Right Analog Stick (Stunt & Rapid Spin) */}
              <div
                className={styles.stickWell}
                onPointerDown={handleRightStickStart}
                title="Right Stick: Drag kiri/kanan untuk manuver spin cepat"
                aria-label="Right Thumbstick"
              >
                <div className={styles.stickThumb} ref={rightStickThumbRef}>
                  <div className={styles.stickRidge} />
                </div>
              </div>

              {/* Home Button & Player Indicator */}
              <div className={styles.joyconBottomMeta}>
                <div className={styles.playerLeds}>
                  <div className={styles.playerLedDot} />
                  <div className={styles.playerLedDotDim} />
                  <div className={styles.playerLedDotDim} />
                  <div className={styles.playerLedDotDim} />
                </div>

                <button
                  className={styles.homeBtn}
                  onClick={() => {
                    stopWheels();
                    resetPosition();
                  }}
                  title="HOME: Rem Darurat & Reset (Esc)"
                  aria-label="Home Button"
                >
                  <HomeIcon />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── KEYBOARD SHORTCUT GUIDE ── */}
        <div className={styles.guideBar}>
          <div>
            <span className={styles.kbdBadge}>W / A / S / D</span> D-Pad Gerak
          </div>
          <div>
            <span className={styles.kbdBadge}>Q / E</span> ZL/ZR Claw Grab & Release
          </div>
          <div>
            <span className={styles.kbdBadge}>H / +</span> X / Plus Klakson
          </div>
          <div>
            <span className={styles.kbdBadge}>Spasi / B</span> Rem Stop
          </div>
          <div>
            <span className={styles.kbdBadge}>1 / 2 / 3</span> Gear Speed (Eco / Norm / Turbo)
          </div>
          <div>
            <span className={styles.kbdBadge}>R / −</span> Reset Kalibrasi
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

function ZapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function MuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {muted ? (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>
      )}
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

