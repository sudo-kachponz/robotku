// src/components/modes/JoystickMode.tsx
//
// 1:1 PlayStation DualShock 4 Landscape Controller & Virtual Arena:
// - Authentic ergonomic DualShock 4 silhouette with realistic angled side grips & bottom arch
// - Upper shoulder triggers (L2, L1, R1, R2) with dynamic LED lightbar atop the Touchpad
// - Embedded Touchpad HD Virtual Arena (2D Kinematic Simulation, Telemetry HUD, Dual Servo meters)
// - Precision D-Pad & Geometric Shape Face Buttons (Triangle, Square, Circle, Cross)
// - Dual Concave Analog Thumbsticks (L3 / R3) with Proportional 360° & Dual-Throttle Drag
// - Speaker grille matrix, circular PS Home Button, Share & Options buttons, E-STOP
// - Zero emoji, Plus Jakarta Sans typography, clean vector SVG icons

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import ConnectHint from './ConnectHint';
import RobotSprite from './RobotSprite';
import { useDrive } from '../../hooks/useDrive';
import { soundFx } from './JoystickAudio';
import styles from './JoystickMode.module.css';

const SERVO1_PORT = 1; // Left continuous drive servo
const SERVO2_PORT = 2; // Right continuous drive servo

const clamp = (v: number, min = -100, max = 100) => Math.max(min, Math.min(max, v));

type ControlType = 'LEVERS' | 'STICK';
type GearLevel = 'ECO' | 'NORMAL' | 'TURBO';

const GEAR_CONFIG: Record<
  GearLevel,
  { label: string; renderIcon: () => React.ReactNode; factor: number; colorClass: string }
> = {
  ECO: { label: 'Pelan', renderIcon: () => <SpeedSlowIcon />, factor: 0.4, colorClass: styles.gearEco },
  NORMAL: { label: 'Normal', renderIcon: () => <SpeedNormalIcon />, factor: 0.75, colorClass: styles.gearNormal },
  TURBO: { label: 'Turbo', renderIcon: () => <SpeedTurboIcon />, factor: 1.0, colorClass: styles.gearTurbo },
};

const LED_PRESETS = [
  { name: 'Biru PS', color: '#38bdf8', rgb: '#0080ff' },
  { name: 'Ungu Neon', color: '#c084fc', rgb: '#ff00ff' },
  { name: 'Merah', color: '#f87171', rgb: '#ff0000' },
  { name: 'Hijau', color: '#34d399', rgb: '#00ff00' },
  { name: 'Kuning', color: '#fbbf24', rgb: '#ffff00' },
  { name: 'Putih', color: '#ffffff', rgb: '#ffffff' },
  { name: 'Mati', color: '#475569', rgb: '#000000' },
];

export default function JoystickMode() {
  const { setPort, setLed, sendCommand } = useDrive();

  // Control state
  const [controlType, setControlType] = useState<ControlType>('STICK');
  const [gear, setGear] = useState<GearLevel>('NORMAL');
  const [s1, setS1] = useState(0); // Left servo (-100..100)
  const [s2, setS2] = useState(0); // Right servo (-100..100)
  const [selectedLed, setSelectedLed] = useState<string>('#38bdf8');
  const [isMuted, setIsMuted] = useState(false);
  const [isHornActive, setIsHornActive] = useState(false);

  // Refs for animation loop & input handling
  const s1Ref = useRef(0);
  const s2Ref = useRef(0);
  const gearRef = useRef<GearLevel>('NORMAL');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const robotElRef = useRef<HTMLDivElement | null>(null);

  // Single 360° stick refs (L3)
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const isDraggingStickRef = useRef(false);

  // Dual sticks (S1 & S2) refs
  const stick1BaseRef = useRef<HTMLDivElement | null>(null);
  const stick1KnobRef = useRef<HTMLDivElement | null>(null);
  const isDraggingStick1Ref = useRef(false);

  const stick2BaseRef = useRef<HTMLDivElement | null>(null);
  const stick2KnobRef = useRef<HTMLDivElement | null>(null);
  const isDraggingStick2Ref = useRef(false);

  // Robot simulation state
  const poseRef = useRef({ x: 0, y: 0, heading: 0 });
  const [telemetry, setTelemetry] = useState({ heading: 0, speed: 0 });
  const [trail, setTrail] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const trailIdRef = useRef(0);

  // Sync ref values
  s1Ref.current = s1;
  s2Ref.current = s2;
  gearRef.current = gear;

  // Apply motor outputs to hardware & update audio engine
  const applyMotors = useCallback(
    (leftVal: number, rightVal: number) => {
      const c1 = clamp(Math.round(leftVal));
      const c2 = clamp(Math.round(rightVal));
      setS1(c1);
      setS2(c2);
      s1Ref.current = c1;
      s2Ref.current = c2;
      setPort(SERVO1_PORT, c1);
      setPort(SERVO2_PORT, c2);
      soundFx.updateEngineSound(c1, c2);
    },
    [setPort],
  );

  // Stop all motors (E-STOP)
  const stopAll = useCallback(() => {
    applyMotors(0, 0);
    soundFx.playEStopAlert();
    if (stickKnobRef.current) stickKnobRef.current.style.transform = `translate(0px, 0px)`;
    if (stick1KnobRef.current) stick1KnobRef.current.style.transform = `translate(0px, 0px)`;
    if (stick2KnobRef.current) stick2KnobRef.current.style.transform = `translate(0px, 0px)`;
  }, [applyMotors]);

  // Apply single servo from lever
  const handleLever1 = useCallback(
    (v: number) => {
      const factor = GEAR_CONFIG[gearRef.current].factor;
      const target = Math.round(v * factor);
      applyMotors(target, s2Ref.current);
    },
    [applyMotors],
  );

  const handleLever2 = useCallback(
    (v: number) => {
      const factor = GEAR_CONFIG[gearRef.current].factor;
      const target = Math.round(v * factor);
      applyMotors(s1Ref.current, target);
    },
    [applyMotors],
  );

  // ── DUAL JOYSTICK POINTER HANDLERS ──
  const handleStick1PointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingStick1Ref.current = true;
    updateStick1Position(e.clientY);
  };

  const handleStick1PointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick1Ref.current) return;
    updateStick1Position(e.clientY);
  };

  const handleStick1PointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick1Ref.current) return;
    isDraggingStick1Ref.current = false;
    if (stick1KnobRef.current) {
      stick1KnobRef.current.style.transform = `translate(0px, 0px)`;
    }
    handleLever1(0);
  };

  const updateStick1Position = (clientY: number) => {
    const base = stick1BaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.height / 2 - 14;

    let dy = clientY - centerY;
    if (Math.abs(dy) > maxRadius) {
      dy = Math.sign(dy) * maxRadius;
    }

    if (stick1KnobRef.current) {
      stick1KnobRef.current.style.transform = `translate(0px, ${dy}px)`;
    }

    const normY = -dy / maxRadius; // +1 (up) .. -1 (down)
    handleLever1(normY * 100);
  };

  const handleStick2PointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingStick2Ref.current = true;
    updateStick2Position(e.clientY);
  };

  const handleStick2PointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick2Ref.current) return;
    updateStick2Position(e.clientY);
  };

  const handleStick2PointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick2Ref.current) return;
    isDraggingStick2Ref.current = false;
    if (stick2KnobRef.current) {
      stick2KnobRef.current.style.transform = `translate(0px, 0px)`;
    }
    handleLever2(0);
  };

  const updateStick2Position = (clientY: number) => {
    const base = stick2BaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.height / 2 - 14;

    let dy = clientY - centerY;
    if (Math.abs(dy) > maxRadius) {
      dy = Math.sign(dy) * maxRadius;
    }

    if (stick2KnobRef.current) {
      stick2KnobRef.current.style.transform = `translate(0px, ${dy}px)`;
    }

    const normY = -dy / maxRadius; // +1 (up) .. -1 (down)
    handleLever2(normY * 100);
  };

  // Klakson / Buzzer Honk
  const triggerHorn = useCallback(() => {
    setIsHornActive(true);
    soundFx.playHorn();
    sendCommand('PLAY_TONE', { hz: 880, ms: 250 });
    setTimeout(() => setIsHornActive(false), 260);
  }, [sendCommand]);

  // LED Underglow selection
  const handleSelectLed = useCallback(
    (colorRgb: string) => {
      setSelectedLed(colorRgb);
      soundFx.playClick(800);
      setLed(colorRgb);
    },
    [setLed],
  );

  // Sound toggle
  const toggleSound = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    soundFx.setMuted(next);
    if (!next) soundFx.playClick(600);
  }, [isMuted]);

  // Gear change
  const changeGear = useCallback((newGear: GearLevel) => {
    setGear(newGear);
    gearRef.current = newGear;
    soundFx.playClick(750);
  }, []);

  // Stunt maneuvers
  const performStunt = useCallback(
    (type: 'SPIN_L' | 'SPIN_R' | 'BOOST') => {
      soundFx.playWhoosh();
      if (type === 'SPIN_L') {
        applyMotors(-100, 100);
        setTimeout(() => applyMotors(0, 0), 450);
      } else if (type === 'SPIN_R') {
        applyMotors(100, -100);
        setTimeout(() => applyMotors(0, 0), 450);
      } else if (type === 'BOOST') {
        applyMotors(100, 100);
        setTimeout(() => applyMotors(0, 0), 400);
      }
    },
    [applyMotors],
  );

  // Reset arena position
  const resetPosition = useCallback(() => {
    poseRef.current = { x: 0, y: 0, heading: 0 };
    setTrail([]);
    soundFx.playClick(500);
    if (robotElRef.current) {
      robotElRef.current.style.transform = `translate(0px, 0px) rotate(0deg)`;
    }
    setTelemetry({ heading: 0, speed: 0 });
  }, []);

  // ── 360° ANALOG STICK POINTER HANDLER (L3) ──
  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingStickRef.current = true;
    updateStickPosition(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStickRef.current) return;
    updateStickPosition(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStickRef.current) return;
    isDraggingStickRef.current = false;
    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate(0px, 0px)`;
    }
    applyMotors(0, 0);
  };

  const updateStickPosition = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 18;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    if (stickKnobRef.current) {
      stickKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    const normX = dx / maxRadius; // -1 (left) .. +1 (right)
    const normY = -dy / maxRadius; // +1 (forward) .. -1 (backward)

    const factor = GEAR_CONFIG[gearRef.current].factor;
    const leftSpeed = clamp((normY + normX * 0.85) * factor * 100);
    const rightSpeed = clamp((normY - normX * 0.85) * factor * 100);

    applyMotors(leftSpeed, rightSpeed);
  };

  // ── KEYBOARD NAVIGATION ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toLowerCase();
      const factor = GEAR_CONFIG[gearRef.current].factor;

      if (e.code === 'Space') {
        e.preventDefault();
        stopAll();
        return;
      }

      if (key === '1') changeGear('ECO');
      if (key === '2') changeGear('NORMAL');
      if (key === '3') changeGear('TURBO');
      if (key === 'h') triggerHorn();
      if (key === 'm') toggleSound();
      if (key === 'r') resetPosition();
      if (key === 'q') performStunt('SPIN_L');
      if (key === 'e') performStunt('SPIN_R');

      if (key === 'tab') {
        e.preventDefault();
        const gears: GearLevel[] = ['ECO', 'NORMAL', 'TURBO'];
        const idx = gears.indexOf(gearRef.current);
        changeGear(gears[(idx + 1) % 3]);
        return;
      }

      // Dual Lever mode keys
      if (controlType === 'LEVERS') {
        if (key === 'w') handleLever1(Math.min(100, s1Ref.current / factor + 25));
        if (key === 's') handleLever1(Math.max(-100, s1Ref.current / factor - 25));
        if (key === 'arrowup') handleLever2(Math.min(100, s2Ref.current / factor + 25));
        if (key === 'arrowdown') handleLever2(Math.max(-100, s2Ref.current / factor - 25));
      } else {
        // Stick mode arrow/WASD drive
        let vx = 0;
        let vy = 0;
        if (key === 'w' || key === 'arrowup') vy += 1;
        if (key === 's' || key === 'arrowdown') vy -= 1;
        if (key === 'a' || key === 'arrowleft') vx -= 1;
        if (key === 'd' || key === 'arrowright') vx += 1;

        if (vx !== 0 || vy !== 0) {
          e.preventDefault();
          const l = clamp((vy + vx * 0.85) * factor * 100);
          const r = clamp((vy - vx * 0.85) * factor * 100);
          applyMotors(l, r);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (controlType === 'STICK') {
          applyMotors(0, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [applyMotors, changeGear, controlType, handleLever1, handleLever2, performStunt, resetPosition, stopAll, toggleSound, triggerHorn]);

  // ── 2D KINEMATICS ARENA SIMULATION LOOP ──
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    let trailTimer = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const stage = stageRef.current;
      const robot = robotElRef.current;
      const leftSpd = s1Ref.current;
      const rightSpd = s2Ref.current;

      if (stage && robot) {
        const pose = poseRef.current;
        const fwdSpeed = (leftSpd + rightSpd) / 2;
        const turnRate = (leftSpd - rightSpd) * 0.9;

        pose.heading = (pose.heading + turnRate * dt + 360) % 360;
        const rad = (pose.heading * Math.PI) / 180;

        pose.x += Math.sin(rad) * fwdSpeed * 1.6 * dt;
        pose.y -= Math.cos(rad) * fwdSpeed * 1.6 * dt;

        const halfW = (stage.clientWidth - 70) / 2;
        const halfH = (stage.clientHeight - 70) / 2;
        pose.x = Math.max(-halfW, Math.min(halfW, pose.x));
        pose.y = Math.max(-halfH, Math.min(halfH, pose.y));

        robot.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.heading}deg)`;

        if (Math.abs(fwdSpeed) > 5 || Math.abs(turnRate) > 5) {
          trailTimer += dt;
          if (trailTimer > 0.12) {
            trailTimer = 0;
            trailIdRef.current += 1;
            const newDot = { id: trailIdRef.current, x: pose.x, y: pose.y };
            setTrail((prev) => [...prev.slice(-14), newDot]);
          }
        }

        setTelemetry({
          heading: Math.round(pose.heading),
          speed: Math.round(fwdSpeed),
        });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fwdIntent = (s1 + s2) / 200;
  const turnIntent = (s1 - s2) / 200;

  // Dynamic lightbar glow color
  const lightbarColor =
    gear === 'TURBO'
      ? '#c084fc'
      : gear === 'ECO'
        ? '#38bdf8'
        : '#818cf8';

  return (
    <ControlLayout title="Joystick">
      <div className={styles.container}>
        <ConnectHint />

        {/* ── SONY DUALSHOCK 4 SCULPTED CONTROLLER ── */}
        <div className={styles.ds4ControllerWrapper}>

          {/* Left & Right Angled Palm Grip Extensions (The Iconic PS4 Handles) */}
          <div className={styles.ds4GripLeft} />
          <div className={styles.ds4GripRight} />

          {/* Controller Main Body */}
          <div className={styles.ds4Body}>

            {/* ── TOP SHOULDER PODS & LIGHTBAR ── */}
            <div className={styles.ds4TopShoulders}>
              {/* L2 & L1 Cluster */}
              <div className={styles.shoulderLeftGroup}>
                <button
                  className={`${styles.triggerBtnL2} ${gear === 'ECO' ? styles.triggerActive : ''}`}
                  onClick={() => {
                    changeGear('ECO');
                    soundFx.playClick(400);
                  }}
                  title="L2: Mode Pelan Eco (1)"
                  aria-label="L2 Trigger"
                >
                  L2
                </button>
                <button
                  className={`${styles.bumperBtnL1} ${isHornActive ? styles.bumperActive : ''}`}
                  onClick={triggerHorn}
                  title="L1: Bunyikan Klakson (H)"
                  aria-label="L1 Bumper"
                >
                  L1
                </button>
              </div>

              {/* Top Touchpad Lightbar Strip */}
              <div className={styles.lightbarFrame}>
                <div
                  className={styles.lightbarStrip}
                  style={{
                    backgroundColor: lightbarColor,
                    boxShadow: `0 0 14px ${lightbarColor}, 0 0 4px ${lightbarColor}`,
                  }}
                  title={`Lightbar: Gear ${gear}`}
                />
              </div>

              {/* R1 & R2 Cluster */}
              <div className={styles.shoulderRightGroup}>
                <button
                  className={styles.bumperBtnR1}
                  onClick={() => {
                    const currentIdx = LED_PRESETS.findIndex((p) => p.rgb === selectedLed);
                    const nextIdx = (currentIdx + 1) % LED_PRESETS.length;
                    handleSelectLed(LED_PRESETS[nextIdx].rgb);
                  }}
                  title="R1: Ganti Warna LED (L)"
                  aria-label="R1 Bumper"
                >
                  R1
                </button>
                <button
                  className={`${styles.triggerBtnR2} ${gear === 'TURBO' ? styles.triggerActive : ''}`}
                  onClick={() => {
                    changeGear('TURBO');
                    performStunt('BOOST');
                  }}
                  title="R2: Turbo Boost (3 / Space)"
                  aria-label="R2 Trigger"
                >
                  R2
                </button>
              </div>
            </div>

            {/* ── MAIN FACE DECK (D-Pad, Touchpad Arena, Action Buttons) ── */}
            <div className={styles.ds4FaceDeck}>

              {/* ── LEFT POD (SHARE & D-PAD) ── */}
              <div className={styles.ds4LeftPod}>
                {/* SHARE Button */}
                <button
                  className={styles.sharePillBtn}
                  onClick={resetPosition}
                  title="SHARE: Reset Posisi Arena (R)"
                  aria-label="Share Button"
                >
                  <span className={styles.pillLabel}>SHARE</span>
                </button>

                {/* Recessed Circular D-Pad Dish */}
                <div className={styles.dpadDish}>
                  <div className={styles.dpadCross}>
                    {/* Up (▲) */}
                    <button
                      className={`${styles.dpadBtn} ${styles.dpadUp}`}
                      onPointerDown={() => {
                        const factor = GEAR_CONFIG[gear].factor;
                        applyMotors(factor * 100, factor * 100);
                      }}
                      onPointerUp={() => applyMotors(0, 0)}
                      onPointerLeave={() => applyMotors(0, 0)}
                      title="D-Pad Atas: Maju (W)"
                      aria-label="Maju"
                    >
                      <DpadArrow dir="up" />
                    </button>

                    {/* Down (▼) */}
                    <button
                      className={`${styles.dpadBtn} ${styles.dpadDown}`}
                      onPointerDown={() => {
                        const factor = GEAR_CONFIG[gear].factor;
                        applyMotors(-factor * 100, -factor * 100);
                      }}
                      onPointerUp={() => applyMotors(0, 0)}
                      onPointerLeave={() => applyMotors(0, 0)}
                      title="D-Pad Bawah: Mundur (S)"
                      aria-label="Mundur"
                    >
                      <DpadArrow dir="down" />
                    </button>

                    {/* Left (◀) */}
                    <button
                      className={`${styles.dpadBtn} ${styles.dpadLeft}`}
                      onPointerDown={() => {
                        const factor = GEAR_CONFIG[gear].factor;
                        applyMotors(-factor * 100, factor * 100);
                      }}
                      onPointerUp={() => applyMotors(0, 0)}
                      onPointerLeave={() => applyMotors(0, 0)}
                      title="D-Pad Kiri: Belok Kiri (A)"
                      aria-label="Belok Kiri"
                    >
                      <DpadArrow dir="left" />
                    </button>

                    {/* Right (►) */}
                    <button
                      className={`${styles.dpadBtn} ${styles.dpadRight}`}
                      onPointerDown={() => {
                        const factor = GEAR_CONFIG[gear].factor;
                        applyMotors(factor * 100, -factor * 100);
                      }}
                      onPointerUp={() => applyMotors(0, 0)}
                      onPointerLeave={() => applyMotors(0, 0)}
                      title="D-Pad Kanan: Belok Kanan (D)"
                      aria-label="Belok Kanan"
                    >
                      <DpadArrow dir="right" />
                    </button>

                    {/* Center D-Pad Hub */}
                    <div className={styles.dpadCenterHub} />
                  </div>
                </div>
              </div>

              {/* ── CENTER TOUCHPAD (VIRTUAL ARENA & TELEMETRY) ── */}
              <div className={styles.ds4CenterPod}>
                <div className={styles.touchpadConsole}>
                  {/* Touchpad Header */}
                  <div className={styles.touchpadHeader}>
                    <div className={styles.touchpadTitle}>
                      <ArenaRadarIcon /> ARENA VIRTUAL
                    </div>
                    <div className={styles.touchpadBadges}>
                      <span className={styles.telemetryBadge}>HDG: {telemetry.heading}°</span>
                      <span className={styles.telemetryBadge}>SPD: {Math.abs(telemetry.speed)}%</span>
                    </div>
                  </div>

                  {/* 2D Kinematic Arena Canvas */}
                  <div className={styles.touchpadArenaStage} ref={stageRef}>
                    <div className={styles.arenaCrosshair} />

                    {trail.map((t) => (
                      <div
                        key={t.id}
                        className={styles.arenaTrailDot}
                        style={{ transform: `translate(${t.x}px, ${t.y}px)` }}
                      />
                    ))}

                    <div className={styles.arenaRobot} ref={robotElRef}>
                      <RobotSprite
                        fwd={fwdIntent}
                        turn={turnIntent}
                        gripperOpen={false}
                        reduced={false}
                      />
                    </div>
                  </div>

                  {/* Touchpad Footer (Dual Servo Speed Telemetry) */}
                  <div className={styles.touchpadServoRow}>
                    <div className={styles.servoBarItem}>
                      <span className={styles.servoLabel}>L-SERVO</span>
                      <div className={styles.meterTrack}>
                        <div className={styles.meterCenterDivider} />
                        <div
                          className={styles.meterFill}
                          style={{
                            width: `${Math.abs(s1) / 2}%`,
                            left: s1 >= 0 ? '50%' : `${50 - Math.abs(s1) / 2}%`,
                            background: s1 >= 0 ? '#34d399' : '#f87171',
                          }}
                        />
                      </div>
                      <span className={`${styles.servoSpeedVal} ${s1 > 0 ? styles.speedFwd : s1 < 0 ? styles.speedRev : ''}`}>
                        {s1 > 0 ? `+${s1}` : s1}%
                      </span>
                    </div>

                    <div className={styles.servoBarItem}>
                      <span className={styles.servoLabel}>R-SERVO</span>
                      <div className={styles.meterTrack}>
                        <div className={styles.meterCenterDivider} />
                        <div
                          className={styles.meterFill}
                          style={{
                            width: `${Math.abs(s2) / 2}%`,
                            left: s2 >= 0 ? '50%' : `${50 - Math.abs(s2) / 2}%`,
                            background: s2 >= 0 ? '#34d399' : '#f87171',
                          }}
                        />
                      </div>
                      <span className={`${styles.servoSpeedVal} ${s2 > 0 ? styles.speedFwd : s2 < 0 ? styles.speedRev : ''}`}>
                        {s2 > 0 ? `+${s2}` : s2}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mode Selector Pill Toggle */}
                <div className={styles.modeToggleRow}>
                  <div className={styles.pillGroup}>
                    <button
                      className={`${styles.pillBtn} ${controlType === 'STICK' ? styles.pillActive : ''}`}
                      onClick={() => { setControlType('STICK'); soundFx.playClick(700); }}
                      title="Mode: 360° Analog Thumbstick"
                    >
                      <AnalogStickIcon /> Stick 360°
                    </button>
                    <button
                      className={`${styles.pillBtn} ${controlType === 'LEVERS' ? styles.pillActive : ''}`}
                      onClick={() => { setControlType('LEVERS'); soundFx.playClick(600); }}
                      title="Mode: Tuas Ganda (S1 & S2)"
                    >
                      <LeversIcon /> Tuas Ganda
                    </button>
                  </div>
                </div>
              </div>

              {/* ── RIGHT POD (OPTIONS & ACTION BUTTONS △ ▢ ◯ ✕) ── */}
              <div className={styles.ds4RightPod}>
                {/* OPTIONS Button */}
                <button
                  className={styles.optionsPillBtn}
                  onClick={() => {
                    const gears: GearLevel[] = ['ECO', 'NORMAL', 'TURBO'];
                    const idx = gears.indexOf(gear);
                    changeGear(gears[(idx + 1) % 3]);
                  }}
                  title="OPTIONS: Ganti Gear Kecepatan (Tab)"
                  aria-label="Options Button"
                >
                  <span className={styles.pillLabel}>OPTIONS</span>
                </button>

                {/* Recessed Circular Action Dish */}
                <div className={styles.actionDish}>
                  <div className={styles.actionCluster}>
                    {/* Triangle (Top - Green) */}
                    <button
                      className={`${styles.actionBtn} ${styles.btnTriangle}`}
                      onClick={() => performStunt('BOOST')}
                      title="Triangle (△): Turbo Boost Stunt (Space)"
                      aria-label="Triangle Boost"
                    >
                      <TriangleIcon />
                    </button>

                    {/* Square (Left - Pink) */}
                    <button
                      className={`${styles.actionBtn} ${styles.btnSquare}`}
                      onClick={() => performStunt('SPIN_L')}
                      title="Square (▢): Putar Kiri 90° CCW (Q)"
                      aria-label="Square Spin Left"
                    >
                      <SquareIcon />
                    </button>

                    {/* Circle (Right - Red) */}
                    <button
                      className={`${styles.actionBtn} ${styles.btnCircle}`}
                      onClick={() => performStunt('SPIN_R')}
                      title="Circle (◯): Putar Kanan 90° CW (E)"
                      aria-label="Circle Spin Right"
                    >
                      <CircleIcon />
                    </button>

                    {/* Cross (Bottom - Blue) */}
                    <button
                      className={`${styles.actionBtn} ${styles.btnCross}`}
                      onClick={stopAll}
                      title="Cross (✕): Rem Darurat / Stop (Space)"
                      aria-label="Cross Emergency Brake"
                    >
                      <CrossIcon />
                    </button>

                    {/* Center Dish Hub */}
                    <div className={styles.actionCenterHub} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── LOWER DECK (ANALOG STICKS & CENTER PS LOGO BRIDGE) ── */}
            <div className={styles.ds4LowerDeck}>

              {/* Left Analog Stick Pod (L3) */}
              <div className={styles.thumbstickDome}>
                <div className={styles.stickDomeLabel}>L3</div>
                {controlType === 'STICK' ? (
                  <div
                    className={styles.stickWell}
                    ref={stickBaseRef}
                    onPointerDown={handleStickPointerDown}
                    onPointerMove={handleStickPointerMove}
                    onPointerUp={handleStickPointerUp}
                    onPointerCancel={handleStickPointerUp}
                    title="L3: Drag 360° untuk kemudi proporsional"
                  >
                    <div className={styles.stickWellBezel} />
                    <div className={styles.stickCrosshairH} />
                    <div className={styles.stickCrosshairV} />
                    <div className={styles.thumbKnob} ref={stickKnobRef}>
                      <div className={styles.thumbRubberRim}>
                        <div className={styles.thumbCenterDish} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={styles.stickWell}
                    ref={stick1BaseRef}
                    onPointerDown={handleStick1PointerDown}
                    onPointerMove={handleStick1PointerMove}
                    onPointerUp={handleStick1PointerUp}
                    onPointerCancel={handleStick1PointerUp}
                    title="L3: Drag vertikal untuk Servo Kiri (S1)"
                  >
                    <div className={styles.stickWellBezel} />
                    <div className={styles.stickCrosshairH} />
                    <div className={styles.stickCrosshairV} />
                    <div className={styles.thumbKnob} ref={stick1KnobRef}>
                      <div className={styles.thumbRubberRim}>
                        <div className={styles.thumbCenterDish} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Center Bridge (Speaker Holes, PS Logo Button, E-STOP) */}
              <div className={styles.centerBridge}>
                {/* Speaker Grille Matrix */}
                <div className={styles.speakerGrille}>
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span key={i} className={styles.speakerHole} />
                  ))}
                </div>

                {/* PS Home Button */}
                <button
                  className={styles.psHomeBtn}
                  onClick={toggleSound}
                  title={isMuted ? 'PS Button: Nyalakan Suara (M)' : 'PS Button: Matikan Suara (M)'}
                  aria-label="PlayStation Home Button"
                >
                  <PsLogoIcon muted={isMuted} />
                </button>

                {/* Glowing Center E-STOP Switch */}
                <button
                  className={styles.centerEstopBtn}
                  onClick={stopAll}
                  title="E-STOP: Hentikan semua motor seketika (Space / Esc)"
                  aria-label="Emergency Stop"
                >
                  <span className={styles.estopText}>STOP</span>
                </button>
              </div>

              {/* Right Analog Stick Pod (R3) */}
              <div className={styles.thumbstickDome}>
                <div className={styles.stickDomeLabel}>R3</div>
                <div
                  className={styles.stickWell}
                  ref={stick2BaseRef}
                  onPointerDown={handleStick2PointerDown}
                  onPointerMove={handleStick2PointerMove}
                  onPointerUp={handleStick2PointerUp}
                  onPointerCancel={handleStick2PointerUp}
                  title="R3: Drag vertikal untuk Servo Kanan (S2)"
                >
                  <div className={styles.stickWellBezel} />
                  <div className={styles.stickCrosshairH} />
                  <div className={styles.stickCrosshairV} />
                  <div className={styles.thumbKnob} ref={stick2KnobRef}>
                    <div className={styles.thumbRubberRim}>
                      <div className={styles.thumbCenterDish} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Headphone / EXT Notch Arch */}
            <div className={styles.bottomPortNotch}>
              <div className={styles.extPortHole} />
              <div className={styles.jackHole} />
            </div>
          </div>
        </div>

        {/* ── ACCESSORY TRAY (LED Underglow & Gears) ── */}
        <div className={styles.accessoryTray}>
          {/* LED Palette */}
          <div className={styles.trayGroup}>
            <span className={styles.trayLabel}>
              <LightbulbIcon /> LED:
            </span>
            <div className={styles.ledColorPicker}>
              {LED_PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={`${styles.ledDotBtn} ${selectedLed === p.rgb ? styles.ledDotSelected : ''}`}
                  style={{ backgroundColor: p.color, color: p.color }}
                  onClick={() => handleSelectLed(p.rgb)}
                  title={`Lampu LED ${p.name}`}
                />
              ))}
            </div>
          </div>

          {/* Gear Selector */}
          <div className={styles.trayGroup}>
            <span className={styles.trayLabel}>GEAR:</span>
            <div className={styles.pillGroup}>
              {(['ECO', 'NORMAL', 'TURBO'] as GearLevel[]).map((g) => {
                const cfg = GEAR_CONFIG[g];
                return (
                  <button
                    key={g}
                    className={`${styles.pillBtn} ${gear === g ? styles.pillActive : ''} ${gear === g ? cfg.colorClass : ''}`}
                    onClick={() => changeGear(g)}
                  >
                    {cfg.renderIcon()} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound Mute Button */}
          <button
            className={styles.audioBtn}
            onClick={toggleSound}
            title={isMuted ? 'Nyalakan Efek Suara' : 'Matikan Efek Suara'}
            aria-label="Toggle Audio"
          >
            {isMuted ? <SoundOffIcon /> : <SoundOnIcon />}
          </button>
        </div>

        {/* ── KEYBOARD SHORTCUT GUIDE ── */}
        <div className={styles.keyboardGuide}>
          <div><span className={styles.kbdBadge}>WASD / ◄▲▼►</span> D-Pad & Kemudi Analog</div>
          <div><span className={styles.kbdBadge}>Spasi / X</span> Rem Darurat (E-Stop)</div>
          <div><span className={styles.kbdBadge}>H / L1</span> Klakson</div>
          <div><span className={styles.kbdBadge}>Q / E</span> Spin CCW / CW</div>
          <div><span className={styles.kbdBadge}>1 / 2 / 3 / Tab</span> Ganti Gear Speed</div>
          <div><span className={styles.kbdBadge}>M</span> Suara</div>
          <div><span className={styles.kbdBadge}>R</span> Reset Arena</div>
        </div>
      </div>
    </ControlLayout>
  );
}

// ── SVG Icon Components ──

function DpadArrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M12 4l-6 7h4v9h4v-9h4z" />
    </svg>
  );
}

function PsLogoIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function TriangleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4l9 16H3z" />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" /><line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </svg>
  );
}

function LeversIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="21" />
      <circle cx="6" cy="14" r="3" fill="currentColor" fillOpacity="0.25" />
      <line x1="18" y1="3" x2="18" y2="21" />
      <circle cx="18" cy="8" r="3" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

function AnalogStickIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <line x1="12" y1="3" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="21" />
      <line x1="3" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function SpeedSlowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l-4 3" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function SpeedNormalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function SpeedTurboIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    </svg>
  );
}

function SoundOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function ArenaRadarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.93 19.07A10 10 0 0 1 12 2a10 10 0 0 1 7.07 17.07" />
      <path d="M8.46 15.54A5 5 0 0 1 12 6a5 5 0 0 1 3.54 9.54" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
    </svg>
  );
}
