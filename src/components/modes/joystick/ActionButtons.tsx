// src/components/modes/joystick/ActionButtons.tsx
// Diamond arrangement of 4 round function action buttons with clean vector line icons.

import React from 'react';
import { HornIcon, LightbulbIcon, RotateCcwIcon, RotateCwIcon } from './Icons';
import styles from '../JoystickMode.module.css';

interface ActionButtonsProps {
  onHorn: () => void;
  onSpinLeft: () => void;
  onSpinRight: () => void;
  onCycleLed: () => void;
  activeActions?: {
    horn?: boolean;
    spinLeft?: boolean;
    spinRight?: boolean;
    led?: boolean;
  };
}

export function ActionButtons({
  onHorn,
  onSpinLeft,
  onSpinRight,
  onCycleLed,
  activeActions = {},
}: ActionButtonsProps) {
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore vibration errors
      }
    }
  };

  const handleAction = (actionFn: () => void) => (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    triggerHaptic();
    actionFn();
  };

  return (
    <div className={styles.actionDiamondContainer} aria-label="Action Buttons">
      <div className={styles.actionDiamondGrid}>
        {/* Top: Horn (Klakson - H) */}
        <button
          type="button"
          className={`${styles.actionBtnRound} ${styles.actionBtnTop} ${activeActions.horn ? styles.actionPressed : ''}`}
          onClick={handleAction(onHorn)}
          title="Klakson"
          aria-label="Klakson"
        >
          <HornIcon className={styles.actionIconSvg} />
        </button>

        {/* Left: Spin Left (Putar Kiri 90° - Q) */}
        <button
          type="button"
          className={`${styles.actionBtnRound} ${styles.actionBtnLeft} ${activeActions.spinLeft ? styles.actionPressed : ''}`}
          onClick={handleAction(onSpinLeft)}
          title="Putar Kiri 90°"
          aria-label="Putar Kiri"
        >
          <RotateCcwIcon className={styles.actionIconSvg} />
        </button>

        {/* Center Pivot Hub */}
        <div className={styles.actionCenterHub} />

        {/* Right: Spin Right (Putar Kanan 90° - E) */}
        <button
          type="button"
          className={`${styles.actionBtnRound} ${styles.actionBtnRight} ${activeActions.spinRight ? styles.actionPressed : ''}`}
          onClick={handleAction(onSpinRight)}
          title="Putar Kanan 90°"
          aria-label="Putar Kanan"
        >
          <RotateCwIcon className={styles.actionIconSvg} />
        </button>

        {/* Bottom: Light / LED Underglow Cycle (L) */}
        <button
          type="button"
          className={`${styles.actionBtnRound} ${styles.actionBtnBottom} ${activeActions.led ? styles.actionPressed : ''}`}
          onClick={handleAction(onCycleLed)}
          title="Ganti Warna Lampu LED"
          aria-label="Lampu LED"
        >
          <LightbulbIcon className={styles.actionIconSvg} />
        </button>
      </div>
    </div>
  );
}
