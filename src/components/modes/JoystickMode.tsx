// src/components/modes/JoystickMode.tsx
//
// RobotKu Pad — Original Controller UI & Virtual Robot Arena:
// - 16:9 proportional vector controller canvas with inline SVG molded chassis (ControllerShell)
// - Dynamic Ambient Aura glow with drift physics & throttle response (AmbientGlow)
// - Embedded HD Virtual Arena Glass Screen with 2D Kinematics, Telemetry & Servo meters (CenterMonitor)
// - 4-Way Directional Pad with tactile segments & haptic response (DPad)
// - Diamond 4-Action Round Function Buttons with clean vector line glyphs (ActionButtons)
// - Dual Concave Analog Thumbsticks with knurled ring & active LED drag aura (AnalogStick)
// - RobotKu Home Mute Button, Shoulder Bumpers, E-Stop Kill Switch, and Accessory Palette Tray
// - 100% original design, zero console branding, full desktop & touch interaction parity

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import ConnectHint from './ConnectHint';
import { useDrive } from '../../hooks/useDrive';
import { soundFx } from './JoystickAudio';
import { ControllerShell } from './joystick/ControllerShell';
import { AmbientGlow } from './joystick/AmbientGlow';
import { CenterMonitor } from './joystick/CenterMonitor';
import { DPad } from './joystick/DPad';
import { ActionButtons } from './joystick/ActionButtons';
import { AnalogStick } from './joystick/AnalogStick';
import { LAYOUT } from './joystick/layoutConfig';
import {
  RobotKuLogoIcon,
  SpeedNormalIcon,
  SpeedSlowIcon,
  SpeedTurboIcon,
  StickIcon,
  LeversIcon,
} from './joystick/Icons';
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
  // factor scales the -100..100 drive value BEFORE SET_PORT. Firmware maps it to
  // servo angle: 90 + value*90/100. A continuous SG90 saturates around ±35-40°
  // offset (value ~40), so the old 0.4/0.75/1.0 all ran the servo flat-out and
  // felt identical (Fajrisya: "gear speed difference not noticeable"). Pull ECO
  // and NORMAL down into the linear band so the three gears are actually
  // distinct; TURBO stays full. Calibration knob — tune per-build on hardware.
  ECO: { label: 'Pelan', renderIcon: () => <SpeedSlowIcon />, factor: 0.25, colorClass: styles.gearEco },
  NORMAL: { label: 'Normal', renderIcon: () => <SpeedNormalIcon />, factor: 0.5, colorClass: styles.gearNormal },
  TURBO: { label: 'Turbo', renderIcon: () => <SpeedTurboIcon />, factor: 1.0, colorClass: styles.gearTurbo },
};

const LED_PRESETS = [
  { name: 'Biru Pad', color: '#38bdf8', rgb: '#0080ff' },
  { name: 'Ungu Neon', color: '#c084fc', rgb: '#ff00ff' },
  { name: 'Merah', color: '#f87171', rgb: '#ff0000' },
  { name: 'Hijau Mint', color: '#34d399', rgb: '#00ff00' },
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

  // Active keyboard direction state for visual lighting
  const [activeDpad, setActiveDpad] = useState<{ up?: boolean; down?: boolean; left?: boolean; right?: boolean }>({});
  const [activeActions, setActiveActions] = useState<{ horn?: boolean; spinLeft?: boolean; spinRight?: boolean; led?: boolean }>({});
  const [isStickDragging, setIsStickDragging] = useState(false);
  const [isStick1Dragging, setIsStick1Dragging] = useState(false);
  const [isStick2Dragging, setIsStick2Dragging] = useState(false);

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
    setIsStickDragging(false);
    setIsStick1Dragging(false);
    setIsStick2Dragging(false);
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
    setIsStick1Dragging(true);
    updateStick1Position(e.clientY);
  };

  const handleStick1PointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick1Ref.current) return;
    updateStick1Position(e.clientY);
  };

  const handleStick1PointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick1Ref.current) return;
    isDraggingStick1Ref.current = false;
    setIsStick1Dragging(false);
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
    const maxRadius = rect.height / 2 - 12;

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
    setIsStick2Dragging(true);
    updateStick2Position(e.clientY);
  };

  const handleStick2PointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick2Ref.current) return;
    updateStick2Position(e.clientY);
  };

  const handleStick2PointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick2Ref.current) return;
    isDraggingStick2Ref.current = false;
    setIsStick2Dragging(false);
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
    const maxRadius = rect.height / 2 - 12;

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
    setActiveActions((prev) => ({ ...prev, horn: true }));
    soundFx.playHorn();
    sendCommand('PLAY_TONE', { hz: 880, ms: 250 });
    setTimeout(() => {
      setActiveActions((prev) => ({ ...prev, horn: false }));
    }, 260);
  }, [sendCommand]);

  // LED Underglow selection
  const handleSelectLed = useCallback(
    (colorRgb: string) => {
      setSelectedLed(colorRgb);
      soundFx.playClick(800);
      setLed(colorRgb);
      setActiveActions((prev) => ({ ...prev, led: true }));
      setTimeout(() => setActiveActions((prev) => ({ ...prev, led: false })), 200);
    },
    [setLed],
  );

  const cycleLed = useCallback(() => {
    const currentIdx = LED_PRESETS.findIndex((p) => p.rgb === selectedLed);
    const nextIdx = (currentIdx + 1) % LED_PRESETS.length;
    handleSelectLed(LED_PRESETS[nextIdx].rgb);
  }, [handleSelectLed, selectedLed]);

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

  const cycleGear = useCallback(() => {
    const gears: GearLevel[] = ['ECO', 'NORMAL', 'TURBO'];
    const idx = gears.indexOf(gearRef.current);
    changeGear(gears[(idx + 1) % 3]);
  }, [changeGear]);

  // Stunt maneuvers
  const performStunt = useCallback(
    (type: 'SPIN_L' | 'SPIN_R' | 'BOOST') => {
      soundFx.playWhoosh();
      if (type === 'SPIN_L') {
        setActiveActions((prev) => ({ ...prev, spinLeft: true }));
        applyMotors(-100, 100);
        setTimeout(() => {
          applyMotors(0, 0);
          setActiveActions((prev) => ({ ...prev, spinLeft: false }));
        }, 450);
      } else if (type === 'SPIN_R') {
        setActiveActions((prev) => ({ ...prev, spinRight: true }));
        applyMotors(100, -100);
        setTimeout(() => {
          applyMotors(0, 0);
          setActiveActions((prev) => ({ ...prev, spinRight: false }));
        }, 450);
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
    setIsStickDragging(true);
    updateStickPosition(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStickRef.current) return;
    updateStickPosition(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStickRef.current) return;
    isDraggingStickRef.current = false;
    setIsStickDragging(false);
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
    const maxRadius = rect.width / 2 - 14;

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
      if (key === 'l') cycleLed();

      if (key === 'tab') {
        e.preventDefault();
        cycleGear();
        return;
      }

      // Visual active D-Pad highlight
      if (key === 'w' || key === 'arrowup') setActiveDpad((prev) => ({ ...prev, up: true }));
      if (key === 's' || key === 'arrowdown') setActiveDpad((prev) => ({ ...prev, down: true }));
      if (key === 'a' || key === 'arrowleft') setActiveDpad((prev) => ({ ...prev, left: true }));
      if (key === 'd' || key === 'arrowright') setActiveDpad((prev) => ({ ...prev, right: true }));

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

      if (key === 'w' || key === 'arrowup') setActiveDpad((prev) => ({ ...prev, up: false }));
      if (key === 's' || key === 'arrowdown') setActiveDpad((prev) => ({ ...prev, down: false }));
      if (key === 'a' || key === 'arrowleft') setActiveDpad((prev) => ({ ...prev, left: false }));
      if (key === 'd' || key === 'arrowright') setActiveDpad((prev) => ({ ...prev, right: false }));

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
  }, [applyMotors, changeGear, controlType, cycleGear, cycleLed, handleLever1, handleLever2, performStunt, resetPosition, stopAll, toggleSound, triggerHorn]);

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

        const halfW = (stage.clientWidth - 50) / 2;
        const halfH = (stage.clientHeight - 50) / 2;
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

  // Compute selected preset color for CSS variable
  const activeColorObj = LED_PRESETS.find((p) => p.rgb === selectedLed) || LED_PRESETS[0];
  const ledGlowColor = activeColorObj.color;

  return (
    <ControlLayout title="Joystick">
      <div className={styles.container}>
        <ConnectHint />

        {/* ── 16:9 PROPORTIONAL ROBOTKU PAD STAGE ── */}
        <div className={styles.padOuterStage}>
          
          {/* Ambient Lighting Aura (Behind Pad, Z-Index 0) */}
          <AmbientGlow ledColor={ledGlowColor} s1={s1} s2={s2} />

          {/* Molded Controller Vector Chassis (Z-Index 1) */}
          <div className={styles.controllerShellSvg}>
            <ControllerShell ledColor={ledGlowColor} />
          </div>

          {/* Interactive Absolute Percentage Overlay (Z-Index 2) */}
          <div className={styles.interactiveOverlay}>
            
            {/* 1. Center Monitor Screen */}
            <div
              className={styles.monitorSlot}
              style={{
                left: LAYOUT.monitor.left,
                top: LAYOUT.monitor.top,
                width: LAYOUT.monitor.width,
                height: LAYOUT.monitor.height,
              }}
            >
              <CenterMonitor
                stageRef={stageRef}
                robotElRef={robotElRef}
                telemetry={telemetry}
                trail={trail}
                fwdIntent={fwdIntent}
                turnIntent={turnIntent}
                s1={s1}
                s2={s2}
                onResetPosition={resetPosition}
              />
            </div>

            {/* 2. Left 4-Way Directional Pad */}
            <div
              className={styles.dpadSlot}
              style={{
                left: LAYOUT.dpad.left,
                top: LAYOUT.dpad.top,
                width: LAYOUT.dpad.width,
                height: LAYOUT.dpad.height,
              }}
            >
              <DPad
                onDirectionStart={(dir) => {
                  const factor = GEAR_CONFIG[gear].factor;
                  if (dir === 'up') applyMotors(factor * 100, factor * 100);
                  if (dir === 'down') applyMotors(-factor * 100, -factor * 100);
                  if (dir === 'left') applyMotors(-factor * 100, factor * 100);
                  if (dir === 'right') applyMotors(factor * 100, -factor * 100);
                }}
                onDirectionEnd={() => applyMotors(0, 0)}
                activeDirections={activeDpad}
              />
            </div>

            {/* 3. Right 4-Action Round Function Buttons */}
            <div
              className={styles.actionsSlot}
              style={{
                left: LAYOUT.actions.left,
                top: LAYOUT.actions.top,
                width: LAYOUT.actions.width,
                height: LAYOUT.actions.height,
              }}
            >
              <ActionButtons
                onHorn={triggerHorn}
                onSpinLeft={() => performStunt('SPIN_L')}
                onSpinRight={() => performStunt('SPIN_R')}
                onCycleLed={cycleLed}
                activeActions={activeActions}
              />
            </div>

            {/* 4. Left Analog Thumbstick (L3) */}
            <div
              className={styles.leftStickSlot}
              style={{
                left: LAYOUT.leftStick.left,
                top: LAYOUT.leftStick.top,
                width: LAYOUT.leftStick.width,
                height: LAYOUT.leftStick.height,
              }}
            >
              {controlType === 'STICK' ? (
                <AnalogStick
                  baseRef={stickBaseRef}
                  knobRef={stickKnobRef}
                  onPointerDown={handleStickPointerDown}
                  onPointerMove={handleStickPointerMove}
                  onPointerUp={handleStickPointerUp}
                  isDragging={isStickDragging}
                  ledColor={ledGlowColor}
                  label="L3"
                  title="L3: Drag 360° untuk kemudi proporsional"
                />
              ) : (
                <AnalogStick
                  baseRef={stick1BaseRef}
                  knobRef={stick1KnobRef}
                  onPointerDown={handleStick1PointerDown}
                  onPointerMove={handleStick1PointerMove}
                  onPointerUp={handleStick1PointerUp}
                  isDragging={isStick1Dragging}
                  ledColor={ledGlowColor}
                  label="TUAS L"
                  title="Tuas L: Drag vertikal untuk Servo Kiri (S1)"
                />
              )}
            </div>

            {/* 5. Right Analog Thumbstick (R3) */}
            <div
              className={styles.rightStickSlot}
              style={{
                left: LAYOUT.rightStick.left,
                top: LAYOUT.rightStick.top,
                width: LAYOUT.rightStick.width,
                height: LAYOUT.rightStick.height,
              }}
            >
              <AnalogStick
                baseRef={stick2BaseRef}
                knobRef={stick2KnobRef}
                onPointerDown={handleStick2PointerDown}
                onPointerMove={handleStick2PointerMove}
                onPointerUp={handleStick2PointerUp}
                isDragging={isStick2Dragging}
                ledColor={ledGlowColor}
                label="TUAS R"
                title="Tuas R: Drag vertikal untuk Servo Kanan (S2)"
              />
            </div>

            {/* 6. Center RobotKu Home / Mute Button */}
            <div
              className={styles.homeButtonSlot}
              style={{
                left: LAYOUT.homeButton.left,
                top: LAYOUT.homeButton.top,
                width: LAYOUT.homeButton.width,
                height: LAYOUT.homeButton.height,
              }}
            >
              <button
                type="button"
                className={styles.robotkuHomeBtn}
                onClick={toggleSound}
                title={isMuted ? 'Nyalakan Efek Suara' : 'Matikan Efek Suara'}
                aria-label="RobotKu Home Audio Button"
              >
                <RobotKuLogoIcon />
              </button>
            </div>

            {/* 7. Left Pill (Gear Selector) */}
            <div
              className={styles.gearPillSlot}
              style={{
                left: LAYOUT.gearPill.left,
                top: LAYOUT.gearPill.top,
                width: LAYOUT.gearPill.width,
                height: LAYOUT.gearPill.height,
              }}
            >
              <button
                type="button"
                className={styles.sidePillBtn}
                onClick={cycleGear}
                title={`Gear: ${gear} — ketuk untuk ganti`}
                aria-label="Cycle Gear"
              >
                {gear.slice(0, 3)}
              </button>
            </div>

            {/* 8. Right Pill (Mode Toggle: STICK / LEVERS) */}
            <div
              className={styles.modePillSlot}
              style={{
                left: LAYOUT.modePill.left,
                top: LAYOUT.modePill.top,
                width: LAYOUT.modePill.width,
                height: LAYOUT.modePill.height,
              }}
            >
              <button
                type="button"
                className={styles.sidePillBtn}
                onClick={() => {
                  setControlType((prev) => (prev === 'STICK' ? 'LEVERS' : 'STICK'));
                  soundFx.playClick(650);
                }}
                title={`Mode Kontrol: ${controlType === 'STICK' ? 'Analog 360°' : 'Tuas Ganda'}`}
                aria-label="Toggle Control Mode"
              >
                {controlType === 'STICK' ? <StickIcon /> : <LeversIcon />}
              </button>
            </div>

            {/* 9. Shoulder Bumpers (L & R) */}
            <div
              className={styles.bumperLeftSlot}
              style={{
                left: LAYOUT.bumperLeft.left,
                top: LAYOUT.bumperLeft.top,
                width: LAYOUT.bumperLeft.width,
                height: LAYOUT.bumperLeft.height,
              }}
            >
              <button
                type="button"
                className={styles.shoulderBumperBtn}
                onClick={() => changeGear('ECO')}
                title="Bumper Kiri: Mode Pelan Eco"
                aria-label="Left Shoulder Bumper"
              />
            </div>

            <div
              className={styles.bumperRightSlot}
              style={{
                left: LAYOUT.bumperRight.left,
                top: LAYOUT.bumperRight.top,
                width: LAYOUT.bumperRight.width,
                height: LAYOUT.bumperRight.height,
              }}
            >
              <button
                type="button"
                className={styles.shoulderBumperBtn}
                onClick={() => {
                  changeGear('TURBO');
                  performStunt('BOOST');
                }}
                title="Bumper Kanan: Turbo Boost"
                aria-label="Right Shoulder Bumper"
              />
            </div>

            {/* 10. Center E-STOP Kill Switch */}
            <div
              className={styles.estopSlot}
              style={{
                left: LAYOUT.estop.left,
                top: LAYOUT.estop.top,
                width: LAYOUT.estop.width,
                height: LAYOUT.estop.height,
              }}
            >
              <button
                type="button"
                className={styles.estopPillBtn}
                onClick={stopAll}
                title="E-STOP: Hentikan semua motor seketika"
                aria-label="Emergency Stop"
              >
                <span className={styles.estopText}>E-STOP</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </ControlLayout>
  );
}
