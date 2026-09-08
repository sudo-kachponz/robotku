// src/components/modes/JoystickMode.tsx
//
// Arcade Control Center & Virtual Robot Arena:
// - Live 2D Kinematic Robot Simulation with arena boundaries & trail dots
// - Twin Flight Throttle Levers + 360° Arcade Analog Thumbstick
// - Dual SG90 Micro Servo Live Visualizer with rotating horns
// - 3-Speed Gearbox (Eco 40%, Normal 75%, Turbo 100%)
// - Glowing E-STOP Kill Switch, Klakson Horn, RGB Headlights & Stunt Maneuvers
// - Web Audio API Procedural Sound FX + Full Desktop Keyboard & Touch Controls

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import ConnectHint from './ConnectHint';
import RobotSprite from './RobotSprite';
import ServoModule from '../blockcoding/sim/ServoModule';
import { useDrive } from '../../hooks/useDrive';
import { soundFx } from './JoystickAudio';
import styles from './JoystickMode.module.css';

const SERVO1_PORT = 1; // Left continuous drive servo
const SERVO2_PORT = 2; // Right continuous drive servo

const clamp = (v: number, min = -100, max = 100) => Math.max(min, Math.min(max, v));

type ControlType = 'LEVERS' | 'STICK';
type GearLevel = 'ECO' | 'NORMAL' | 'TURBO';

const GEAR_CONFIG: Record<GearLevel, { label: string; icon: string; factor: number; colorClass: string }> = {
  ECO: { label: 'Pelan', icon: '🐢', factor: 0.4, colorClass: '' },
  NORMAL: { label: 'Normal', icon: '⚡', factor: 0.75, colorClass: '' },
  TURBO: { label: 'Turbo', icon: '🚀', factor: 1.0, colorClass: styles.gearTurbo },
};

const LED_PRESETS = [
  { name: 'Merah', color: '#EF4444', rgb: '#ff0000' },
  { name: 'Hijau', color: '#10B981', rgb: '#00ff00' },
  { name: 'Biru', color: '#3B82F6', rgb: '#0080ff' },
  { name: 'Kuning', color: '#F59E0B', rgb: '#ffff00' },
  { name: 'Ungu', color: '#A855F7', rgb: '#ff00ff' },
  { name: 'Putih', color: '#FFFFFF', rgb: '#ffffff' },
  { name: 'Mati', color: '#334155', rgb: '#000000' },
];

export default function JoystickMode() {
  const { setPort, setLed, sendCommand } = useDrive();

  // Control state
  const [controlType, setControlType] = useState<ControlType>('LEVERS');
  const [gear, setGear] = useState<GearLevel>('NORMAL');
  const [s1, setS1] = useState(0); // Left servo (-100..100)
  const [s2, setS2] = useState(0); // Right servo (-100..100)
  const [selectedLed, setSelectedLed] = useState<string>('#3B82F6');
  const [isMuted, setIsMuted] = useState(false);
  const [isHornActive, setIsHornActive] = useState(false);

  // Refs for animation loop & input handling
  const s1Ref = useRef(0);
  const s2Ref = useRef(0);
  const gearRef = useRef<GearLevel>('NORMAL');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const robotElRef = useRef<HTMLDivElement | null>(null);
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const isDraggingStickRef = useRef(false);

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

  // ── 360° ANALOG STICK POINTER HANDLER ──
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
    // Reset knob to center
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
    const maxRadius = rect.width / 2 - 20;

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

    // Normalized coordinates (-1..1)
    const normX = dx / maxRadius; // -1 (left) .. +1 (right)
    const normY = -dy / maxRadius; // +1 (forward) .. -1 (backward)

    // Differential drive mixing
    const factor = GEAR_CONFIG[gearRef.current].factor;
    const leftSpeed = clamp((normY + normX * 0.85) * factor * 100);
    const rightSpeed = clamp((normY - normX * 0.85) * factor * 100);

    applyMotors(leftSpeed, rightSpeed);
  };

  // ── KEYBOARD NAVIGATION ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing if user is in an input
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

      // Dual Lever mode keys
      if (controlType === 'LEVERS') {
        if (key === 'w') handleLever1(Math.min(100, s1Ref.current / factor + 25));
        if (key === 's') handleLever1(Math.max(-100, s1Ref.current / factor - 25));
        if (key === 'e' || key === 'arrowup') handleLever2(Math.min(100, s2Ref.current / factor + 25));
        if (key === 'd' || key === 'arrowdown') handleLever2(Math.max(-100, s2Ref.current / factor - 25));
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyMotors, changeGear, controlType, handleLever1, handleLever2, stopAll, triggerHorn]);

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
        // Continuous Servo Differential Kinematics
        const fwdSpeed = (leftSpd + rightSpd) / 2; // px speed component
        const turnRate = (leftSpd - rightSpd) * 0.9; // deg/sec component

        pose.heading = (pose.heading + turnRate * dt + 360) % 360;
        const rad = (pose.heading * Math.PI) / 180;

        pose.x += Math.sin(rad) * fwdSpeed * 1.6 * dt;
        pose.y -= Math.cos(rad) * fwdSpeed * 1.6 * dt;

        // Arena boundary collision clamp
        const halfW = (stage.clientWidth - 80) / 2;
        const halfH = (stage.clientHeight - 80) / 2;
        pose.x = Math.max(-halfW, Math.min(halfW, pose.x));
        pose.y = Math.max(-halfH, Math.min(halfH, pose.y));

        robot.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.heading}deg)`;

        // Periodic breadcrumb trail dots when moving
        if (Math.abs(fwdSpeed) > 5 || Math.abs(turnRate) > 5) {
          trailTimer += dt;
          if (trailTimer > 0.12) {
            trailTimer = 0;
            trailIdRef.current += 1;
            const newDot = { id: trailIdRef.current, x: pose.x, y: pose.y };
            setTrail((prev) => [...prev.slice(-14), newDot]);
          }
        }

        // Update telemetry badge
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

  return (
    <ControlLayout title="Joystick & Arena Lab">
      <div className={styles.container}>
        <ConnectHint />

        {/* ── TOP COCKPIT BAR ── */}
        <div className={styles.topCockpit}>
          {/* Mode Switcher */}
          <div className={styles.pillGroup}>
            <button
              className={`${styles.pillBtn} ${controlType === 'LEVERS' ? styles.pillActive : ''}`}
              onClick={() => {
                setControlType('LEVERS');
                soundFx.playClick(600);
              }}
            >
              <span>🎛️</span> Tuas Ganda (S1 & S2)
            </button>
            <button
              className={`${styles.pillBtn} ${controlType === 'STICK' ? styles.pillActive : ''}`}
              onClick={() => {
                setControlType('STICK');
                soundFx.playClick(700);
              }}
            >
              <span>🕹️</span> 360° Analog Stick
            </button>
          </div>

          {/* Speed Limiters / Gears */}
          <div className={styles.pillGroup}>
            {(['ECO', 'NORMAL', 'TURBO'] as GearLevel[]).map((g) => {
              const cfg = GEAR_CONFIG[g];
              const isActive = gear === g;
              return (
                <button
                  key={g}
                  className={`${styles.pillBtn} ${isActive ? styles.pillActive : ''} ${
                    isActive ? cfg.colorClass : ''
                  }`}
                  onClick={() => changeGear(g)}
                >
                  <span>{cfg.icon}</span> {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Sound Synthesizer Toggle */}
          <button
            className={styles.audioBtn}
            onClick={toggleSound}
            title={isMuted ? 'Nyalakan Efek Suara' : 'Matikan Efek Suara'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* ── MAIN FLIGHT DECK ── */}
        <div className={styles.mainDeck}>
          {/* LEFT: 2D KINEMATIC ARENA */}
          <div className={styles.arenaCard}>
            <div className={styles.arenaHeader}>
              <div className={styles.arenaTitle}>
                <span>📡</span> Arena Virtual Robotku
              </div>
              <div className={styles.arenaStatusBadge}>
                <span className={styles.arenaStatusDot} />
                LIVE SIM
              </div>
            </div>

            <div className={styles.arenaStage} ref={stageRef}>
              <div className={styles.arenaCrosshair} />

              {/* Breadcrumb Trail */}
              {trail.map((t) => (
                <div
                  key={t.id}
                  className={styles.arenaTrailDot}
                  style={{
                    transform: `translate(${t.x}px, ${t.y}px)`,
                  }}
                />
              ))}

              {/* Simulated Robot Sprite */}
              <div className={styles.arenaRobot} ref={robotElRef}>
                <RobotSprite
                  fwd={fwdIntent}
                  turn={turnIntent}
                  gripperOpen={false}
                  reduced={false}
                />
              </div>
            </div>

            <div className={styles.arenaFooter}>
              <div className={styles.telemetryBadges}>
                <span className={styles.telemetryChip}>HDG: {telemetry.heading}°</span>
                <span className={styles.telemetryChip}>SPD: {telemetry.speed}%</span>
              </div>
              <button className={styles.resetPosBtn} onClick={resetPosition} title="Reset Posisi Robot ke Tengah">
                🎯 Reset Posisi
              </button>
            </div>
          </div>

          {/* RIGHT: CONTROLS CONSOLE */}
          <div className={styles.consoleCard}>
            {/* ── MODE A: DUAL FLIGHT THROTTLE LEVERS ── */}
            {controlType === 'LEVERS' && (
              <div className={styles.dualThrottleStage}>
                {/* Servo 1 Lever (Left) */}
                <div className={styles.leverColumn}>
                  <div className={styles.leverHeader}>
                    <span className={styles.leverTitle}>Servo 1 (Kiri)</span>
                    <span
                      className={`${styles.leverSpeed} ${
                        s1 > 0 ? styles.leverSpeedFwd : s1 < 0 ? styles.leverSpeedRev : ''
                      }`}
                    >
                      {s1 > 0 ? `+${s1}` : s1}%
                    </span>
                  </div>

                  <div className={styles.leverTrackWrapper}>
                    <input
                      className={styles.leverRangeInput}
                      type="range"
                      min={-100}
                      max={100}
                      value={s1}
                      onChange={(e) => handleLever1(Number(e.target.value))}
                      onPointerUp={() => handleLever1(0)}
                      onPointerCancel={() => handleLever1(0)}
                    />
                  </div>

                  {/* Quick Preset Step Buttons */}
                  <div className={styles.leverQuickButtons}>
                    <button
                      className={`${styles.quickStepBtn} ${s1 === 100 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever1(100)}
                    >
                      ▲ +100%
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s1 === 50 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever1(50)}
                    >
                      ▲ +50%
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s1 === 0 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever1(0)}
                    >
                      ■ 0
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s1 === -50 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever1(-50)}
                    >
                      ▼ -50%
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s1 === -100 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever1(-100)}
                    >
                      ▼ -100%
                    </button>
                  </div>

                  {/* Live SG90 Servo Horn Preview */}
                  <div className={styles.servoMiniPreview}>
                    <ServoModule speed={s1} />
                  </div>
                </div>

                {/* Center Action Column */}
                <div className={styles.centerActionCol}>
                  {/* Glowing E-STOP Button */}
                  <button className={styles.eStopButton} onClick={stopAll} title="Emergency Stop (Spasi)">
                    <span className={styles.eStopLabel}>E-STOP</span>
                    <span className={styles.eStopKeyHint}>[SPASI]</span>
                  </button>

                  {/* Horn / Klakson */}
                  <button
                    className={styles.hornButton}
                    onClick={triggerHorn}
                    style={isHornActive ? { transform: 'scale(1.08)', background: '#F59E0B', color: '#000' } : {}}
                    title="Bunyikan Klakson (H)"
                  >
                    <span>📢</span> Klakson
                  </button>
                </div>

                {/* Servo 2 Lever (Right) */}
                <div className={styles.leverColumn}>
                  <div className={styles.leverHeader}>
                    <span className={styles.leverTitle}>Servo 2 (Kanan)</span>
                    <span
                      className={`${styles.leverSpeed} ${
                        s2 > 0 ? styles.leverSpeedFwd : s2 < 0 ? styles.leverSpeedRev : ''
                      }`}
                    >
                      {s2 > 0 ? `+${s2}` : s2}%
                    </span>
                  </div>

                  <div className={styles.leverTrackWrapper}>
                    <input
                      className={styles.leverRangeInput}
                      type="range"
                      min={-100}
                      max={100}
                      value={s2}
                      onChange={(e) => handleLever2(Number(e.target.value))}
                      onPointerUp={() => handleLever2(0)}
                      onPointerCancel={() => handleLever2(0)}
                    />
                  </div>

                  {/* Quick Preset Step Buttons */}
                  <div className={styles.leverQuickButtons}>
                    <button
                      className={`${styles.quickStepBtn} ${s2 === 100 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever2(100)}
                    >
                      ▲ +100%
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s2 === 50 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever2(50)}
                    >
                      ▲ +50%
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s2 === 0 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever2(0)}
                    >
                      ■ 0
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s2 === -50 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever2(-50)}
                    >
                      ▼ -50%
                    </button>
                    <button
                      className={`${styles.quickStepBtn} ${s2 === -100 ? styles.quickStepActive : ''}`}
                      onClick={() => handleLever2(-100)}
                    >
                      ▼ -100%
                    </button>
                  </div>

                  {/* Live SG90 Servo Horn Preview */}
                  <div className={styles.servoMiniPreview}>
                    <ServoModule speed={s2} />
                  </div>
                </div>
              </div>
            )}

            {/* ── MODE B: 360° ARCADE ANALOG STICK ── */}
            {controlType === 'STICK' && (
              <div className={styles.analogStickStage}>
                <div className={styles.stickAndTelemetryRow}>
                  {/* Virtual Thumbstick Base */}
                  <div
                    className={styles.joystickBaseRing}
                    ref={stickBaseRef}
                    onPointerDown={handleStickPointerDown}
                    onPointerMove={handleStickPointerMove}
                    onPointerUp={handleStickPointerUp}
                    onPointerCancel={handleStickPointerUp}
                  >
                    <div className={styles.joystickDirectionLabels}>
                      <span className={styles.dirLabelTop}>▲ MAJU</span>
                      <span className={styles.dirLabelBottom}>▼ MUNDUR</span>
                      <span className={styles.dirLabelLeft}>◄ KIRI</span>
                      <span className={styles.dirLabelRight}>KANAN ►</span>
                    </div>
                    <div className={styles.joystickTargetRing} />
                    <div className={styles.joystickCrossH} />
                    <div className={styles.joystickCrossV} />
                    <div className={styles.joystickThumbKnob} ref={stickKnobRef}>
                      <div className={styles.joystickThumbGrip} />
                    </div>
                  </div>

                  {/* Dual Servo Telemetry Gauges & Controls */}
                  <div className={styles.servoTelemetryPair}>
                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardHeader}>
                        <div className={styles.telemetryLabelRow}>
                          <span className={styles.telemetryName}>Servo 1 (Kiri)</span>
                          <span
                            className={`${styles.telemetryValue} ${
                              s1 > 0 ? styles.leverSpeedFwd : s1 < 0 ? styles.leverSpeedRev : ''
                            }`}
                          >
                            {s1 > 0 ? `+${s1}` : s1}%
                          </span>
                        </div>
                        <div className={styles.meterTrack}>
                          <div className={styles.meterCenterDivider} />
                          <div
                            className={styles.meterFill}
                            style={{
                              width: `${Math.abs(s1) / 2}%`,
                              left: s1 >= 0 ? '50%' : `${50 - Math.abs(s1) / 2}%`,
                              background: s1 >= 0 ? '#4ADE80' : '#F87171',
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.telemetryServoBox}>
                        <ServoModule speed={s1} />
                      </div>
                    </div>

                    <div className={styles.telemetryCard}>
                      <div className={styles.telemetryCardHeader}>
                        <div className={styles.telemetryLabelRow}>
                          <span className={styles.telemetryName}>Servo 2 (Kanan)</span>
                          <span
                            className={`${styles.telemetryValue} ${
                              s2 > 0 ? styles.leverSpeedFwd : s2 < 0 ? styles.leverSpeedRev : ''
                            }`}
                          >
                            {s2 > 0 ? `+${s2}` : s2}%
                          </span>
                        </div>
                        <div className={styles.meterTrack}>
                          <div className={styles.meterCenterDivider} />
                          <div
                            className={styles.meterFill}
                            style={{
                              width: `${Math.abs(s2) / 2}%`,
                              left: s2 >= 0 ? '50%' : `${50 - Math.abs(s2) / 2}%`,
                              background: s2 >= 0 ? '#4ADE80' : '#F87171',
                            }}
                          />
                        </div>
                      </div>
                      <div className={styles.telemetryServoBox}>
                        <ServoModule speed={s2} />
                      </div>
                    </div>

                    {/* Integrated Action Row (E-STOP + Klakson) */}
                    <div className={styles.stickActionRow}>
                      <button className={styles.eStopButton} onClick={stopAll} title="Emergency Stop (Spasi)">
                        <span className={styles.eStopLabel}>E-STOP</span>
                        <span className={styles.eStopKeyHint}>[SPASI]</span>
                      </button>

                      <button
                        className={styles.hornButton}
                        onClick={triggerHorn}
                        style={isHornActive ? { transform: 'scale(1.06)', background: '#F59E0B', color: '#000' } : {}}
                        title="Bunyikan Klakson (H)"
                      >
                        <span>📢</span> Klakson
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ACTION DECK GADGETS (LEDs & Stunt buttons) ── */}
            <div className={styles.actionGadgetsBar}>
              {/* RGB LED Lamp Selector */}
              <div className={styles.gadgetGroup}>
                <span className={styles.gadgetLabel}>💡 LED:</span>
                <div className={styles.ledColorPicker}>
                  {LED_PRESETS.map((p) => {
                    const isSelected = selectedLed === p.rgb;
                    return (
                      <button
                        key={p.name}
                        className={`${styles.ledDotBtn} ${isSelected ? styles.ledDotSelected : ''}`}
                        style={{ backgroundColor: p.color, color: p.color }}
                        onClick={() => handleSelectLed(p.rgb)}
                        title={`Lampu LED ${p.name}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Stunt Quick Maneuvers */}
              <div className={styles.gadgetGroup}>
                <span className={styles.gadgetLabel}>⚡ Manuver:</span>
                <button
                  className={styles.stuntBtn}
                  onClick={() => performStunt('SPIN_L')}
                  title="Putar Kiri Cepat"
                >
                  ↺ Putar Kiri
                </button>
                <button
                  className={styles.stuntBtn}
                  onClick={() => performStunt('SPIN_R')}
                  title="Putar Kanan Cepat"
                >
                  ↻ Putar Kanan
                </button>
                <button
                  className={styles.stuntBtn}
                  onClick={() => performStunt('BOOST')}
                  title="Dorongan Turbo Cepat"
                >
                  🚀 Boost
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── KEYBOARD SHORTCUT GUIDE ── */}
        <div className={styles.keyboardGuide}>
          <div>
            <span className={styles.kbdBadge}>W/S</span> Tuas Kiri
          </div>
          <div>
            <span className={styles.kbdBadge}>E/D</span> Tuas Kanan
          </div>
          <div>
            <span className={styles.kbdBadge}>WASD / ◄▲▼►</span> Analog Stick
          </div>
          <div>
            <span className={styles.kbdBadge}>SPASI</span> E-Stop
          </div>
          <div>
            <span className={styles.kbdBadge}>H</span> Klakson
          </div>
          <div>
            <span className={styles.kbdBadge}>1 / 2 / 3</span> Gigi Speed
          </div>
        </div>
      </div>
    </ControlLayout>
  );
}
