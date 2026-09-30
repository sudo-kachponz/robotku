// src/components/modes/joystick/DPad.tsx
// 4-Way Directional Pad for RobotKu Pad with tactile segment press states & haptic response.

import React from 'react';
import { DpadArrowIcon } from './Icons';
import styles from '../JoystickMode.module.css';

interface DPadProps {
  onDirectionStart: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onDirectionEnd: () => void;
  activeDirections?: { up?: boolean; down?: boolean; left?: boolean; right?: boolean };
}

export function DPad({ onDirectionStart, onDirectionEnd, activeDirections = {} }: DPadProps) {
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore vibration errors
      }
    }
  };

  const handlePointerDown = (dir: 'up' | 'down' | 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault();
    triggerHaptic();
    onDirectionStart(dir);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    onDirectionEnd();
  };

  return (
    <div className={styles.dpadContainer} aria-label="Directional Pad">
      <div className={styles.dpadGrid}>
        {/* Up (▲) */}
        <button
          type="button"
          className={`${styles.dpadSegment} ${styles.dpadUp} ${activeDirections.up ? styles.dpadPressed : ''}`}
          onPointerDown={handlePointerDown('up')}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="D-Pad Maju (W / ▲)"
          aria-label="Maju"
        >
          <DpadArrowIcon dir="up" />
        </button>

        {/* Left (◀) */}
        <button
          type="button"
          className={`${styles.dpadSegment} ${styles.dpadLeft} ${activeDirections.left ? styles.dpadPressed : ''}`}
          onPointerDown={handlePointerDown('left')}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="D-Pad Belok Kiri (A / ◀)"
          aria-label="Belok Kiri"
        >
          <DpadArrowIcon dir="left" />
        </button>

        {/* Center Hub */}
        <div className={styles.dpadCenterPivot} />

        {/* Right (►) */}
        <button
          type="button"
          className={`${styles.dpadSegment} ${styles.dpadRight} ${activeDirections.right ? styles.dpadPressed : ''}`}
          onPointerDown={handlePointerDown('right')}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="D-Pad Belok Kanan (D / ►)"
          aria-label="Belok Kanan"
        >
          <DpadArrowIcon dir="right" />
        </button>

        {/* Down (▼) */}
        <button
          type="button"
          className={`${styles.dpadSegment} ${styles.dpadDown} ${activeDirections.down ? styles.dpadPressed : ''}`}
          onPointerDown={handlePointerDown('down')}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="D-Pad Mundur (S / ▼)"
          aria-label="Mundur"
        >
          <DpadArrowIcon dir="down" />
        </button>
      </div>
    </div>
  );
}
