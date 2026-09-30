// src/components/modes/joystick/AmbientGlow.tsx
// Ambient lighting aura situated behind the RobotKu Pad with drift animations and throttle reactivity.

import React from 'react';
import styles from '../JoystickMode.module.css';

interface AmbientGlowProps {
  ledColor: string;
  s1: number;
  s2: number;
}

export function AmbientGlow({ ledColor, s1, s2 }: AmbientGlowProps) {
  const throttle = Math.min(1, (Math.abs(s1) + Math.abs(s2)) / 200);
  const scaleBoost = 1 + throttle * 0.18;
  const opacityBoost = 0.55 + throttle * 0.35;

  return (
    <div
      className={styles.ambientAuraContainer}
      style={{
        transform: `scale(${scaleBoost})`,
        opacity: opacityBoost,
      }}
      aria-hidden="true"
    >
      {/* Dominant LED aura blob */}
      <div
        className={`${styles.auraBlob} ${styles.auraBlobLed}`}
        style={{
          backgroundColor: ledColor,
          boxShadow: `0 0 160px 80px ${ledColor}`,
        }}
      />

      {/* Violet drift blob */}
      <div className={`${styles.auraBlob} ${styles.auraBlobViolet}`} />

      {/* Sky Blue drift blob */}
      <div className={`${styles.auraBlob} ${styles.auraBlobSky}`} />

      {/* Mint / Emerald drift blob */}
      <div className={`${styles.auraBlob} ${styles.auraBlobMint}`} />

      {/* Pink accent drift blob */}
      <div className={`${styles.auraBlob} ${styles.auraBlobPink}`} />
    </div>
  );
}
