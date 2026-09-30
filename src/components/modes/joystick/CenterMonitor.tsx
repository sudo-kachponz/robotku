// src/components/modes/joystick/CenterMonitor.tsx
// Embedded HD Virtual Arena Monitor with RobotSprite, breadcrumb trail, and dual servo speed gauges.

import React from 'react';
import RobotSprite from '../RobotSprite';
import { RadarIcon, ResetIcon } from './Icons';
import styles from '../JoystickMode.module.css';

interface TrailDot {
  id: number;
  x: number;
  y: number;
}

interface CenterMonitorProps {
  stageRef: React.RefObject<HTMLDivElement | null>;
  robotElRef: React.RefObject<HTMLDivElement | null>;
  telemetry: { heading: number; speed: number };
  trail: TrailDot[];
  fwdIntent: number;
  turnIntent: number;
  s1: number;
  s2: number;
  onResetPosition: () => void;
}

export function CenterMonitor({
  stageRef,
  robotElRef,
  telemetry,
  trail,
  fwdIntent,
  turnIntent,
  s1,
  s2,
  onResetPosition,
}: CenterMonitorProps) {
  return (
    <div className={styles.centerMonitorFrame}>
      {/* Dark Glass Screen Bezel & Scanlines */}
      <div className={styles.screenGlassOverlay} />

      {/* Monitor Header Bar */}
      <div className={styles.monitorHeader}>
        <div className={styles.monitorTitle}>
          <RadarIcon className={styles.radarIconSvg} />
          <span>ROBOTKU ARENA</span>
        </div>

        <div className={styles.telemetryGroup}>
          <span className={styles.telemetryChip}>HDG: {telemetry.heading}°</span>
          <span className={styles.telemetryChip}>SPD: {Math.abs(telemetry.speed)}%</span>
          <button
            type="button"
            className={styles.resetArenaBtn}
            onClick={onResetPosition}
            title="Reset Posisi Arena (R)"
            aria-label="Reset Arena Position"
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      {/* 2D Kinematic Virtual Arena Canvas */}
      <div className={styles.arenaStage} ref={stageRef}>
        {/* Center Target Crosshair */}
        <div className={styles.arenaCrosshair} />

        {/* Motion Breadcrumb Trail */}
        {trail.map((t) => (
          <div
            key={t.id}
            className={styles.arenaTrailDot}
            style={{ transform: `translate(${t.x}px, ${t.y}px)` }}
          />
        ))}

        {/* Robot Sprite Avatar */}
        <div className={styles.arenaRobot} ref={robotElRef}>
          <RobotSprite
            fwd={fwdIntent}
            turn={turnIntent}
            gripperOpen={false}
            reduced={false}
          />
        </div>
      </div>

      {/* Dual Continuous Servo Speed Telemetry Bars */}
      <div className={styles.monitorServoFooter}>
        {/* Left Servo (S1) */}
        <div className={styles.servoMeterItem}>
          <span className={styles.servoTag}>L-SERVO</span>
          <div className={styles.meterTrack}>
            <div className={styles.meterDivider} />
            <div
              className={styles.meterFill}
              style={{
                width: `${Math.abs(s1) / 2}%`,
                left: s1 >= 0 ? '50%' : `${50 - Math.abs(s1) / 2}%`,
                backgroundColor: s1 >= 0 ? 'var(--emerald, #10b981)' : 'var(--red, #e5484d)',
              }}
            />
          </div>
          <span className={`${styles.servoVal} ${s1 > 0 ? styles.valFwd : s1 < 0 ? styles.valRev : ''}`}>
            {s1 > 0 ? `+${s1}` : s1}%
          </span>
        </div>

        {/* Right Servo (S2) */}
        <div className={styles.servoMeterItem}>
          <span className={styles.servoTag}>R-SERVO</span>
          <div className={styles.meterTrack}>
            <div className={styles.meterDivider} />
            <div
              className={styles.meterFill}
              style={{
                width: `${Math.abs(s2) / 2}%`,
                left: s2 >= 0 ? '50%' : `${50 - Math.abs(s2) / 2}%`,
                backgroundColor: s2 >= 0 ? 'var(--emerald, #10b981)' : 'var(--red, #e5484d)',
              }}
            />
          </div>
          <span className={`${styles.servoVal} ${s2 > 0 ? styles.valFwd : s2 < 0 ? styles.valRev : ''}`}>
            {s2 > 0 ? `+${s2}` : s2}%
          </span>
        </div>
      </div>
    </div>
  );
}
