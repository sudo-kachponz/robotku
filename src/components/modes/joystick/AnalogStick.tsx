// src/components/modes/joystick/AnalogStick.tsx
// Precision analog thumbstick with concave molded cap, knurled grip ring, and reactive LED drag aura.

import React from 'react';
import styles from '../JoystickMode.module.css';

interface AnalogStickProps {
  baseRef: React.RefObject<HTMLDivElement | null>;
  knobRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  ledColor?: string;
  label?: string;
  title?: string;
}

export function AnalogStick({
  baseRef,
  knobRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isDragging = false,
  ledColor = '#38bdf8',
  label,
  title,
}: AnalogStickProps) {
  return (
    <div className={styles.stickDomeWrapper} title={title}>
      {label && <span className={styles.stickDomeLabel}>{label}</span>}

      <div
        className={`${styles.stickWell} ${isDragging ? styles.stickWellDragging : ''}`}
        ref={baseRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Active Drag Aura Ring in LED Color */}
        {isDragging && (
          <div
            className={styles.stickDragAuraRing}
            style={{
              borderColor: ledColor,
              boxShadow: `0 0 16px 2px ${ledColor}`,
            }}
          />
        )}

        {/* Orientation Crosshairs */}
        <div className={styles.stickCrosshairH} />
        <div className={styles.stickCrosshairV} />

        {/* Movable Thumb Knob */}
        <div className={styles.thumbKnob} ref={knobRef}>
          <div className={styles.thumbKnurledRim}>
            <div className={styles.thumbConcaveDish}>
              <div className={styles.thumbCenterPebble} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
