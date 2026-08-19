// src/components/modes/TankMode.tsx
//
// Tank Mode — two throttle sliders (L,R) + turn buttons + turret CW/CCW.
// Left slider → SET_PORT left ports; right slider → right ports; turret → SET_PORT(turret,±).
// Keybinds: Left throttle W/S, Right throttle E/D, Turret CCW Q / CW R.

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import HoldButton from './HoldButton';
import ConnectHint from './ConnectHint';
import { useDrive, useSettings } from '../../hooks/useDrive';
import styles from '../../styles/ModeControls.module.css';

const clamp = (v: number) => Math.max(-100, Math.min(100, v));

export default function TankMode() {
  const { driveGroup, stopGroup, setPort } = useDrive();
  const { mapping } = useSettings();
  const { left, right, turret } = mapping.tank;

  const [leftT, setLeftT] = useState(0);
  const [rightT, setRightT] = useState(0);
  const leftRef = useRef(0);
  const rightRef = useRef(0);

  const applyLeft = useCallback(
    (v: number) => {
      const c = clamp(v);
      leftRef.current = c;
      setLeftT(c);
      driveGroup(left, c);
    },
    [driveGroup, left],
  );
  const applyRight = useCallback(
    (v: number) => {
      const c = clamp(v);
      rightRef.current = c;
      setRightT(c);
      driveGroup(right, c);
    },
    [driveGroup, right],
  );

  // Keybinds — nudge throttles; Q/R handled by turret HoldButtons below.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': applyLeft(leftRef.current + 20); break;
        case 's': applyLeft(leftRef.current - 20); break;
        case 'e': applyRight(rightRef.current + 20); break;
        case 'd': applyRight(rightRef.current - 20); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [applyLeft, applyRight]);

  const turnLeft = () => { driveGroup(left, -100); driveGroup(right, 100); };
  const turnRight = () => { driveGroup(left, 100); driveGroup(right, -100); };
  const restore = () => { driveGroup(left, leftRef.current); driveGroup(right, rightRef.current); };

  return (
    <ControlLayout title="Tank Mode">
      <ConnectHint />
      <div className={styles.wrap}>
        <div className={styles.tankStage}>
          <div className={styles.throttle}>
            <input
              className={styles.throttleSlider}
              type="range" min={-100} max={100} value={leftT}
              onChange={(e) => applyLeft(Number(e.target.value))}
            />
            <span className={styles.throttleLabel}>Kiri (W/S)</span>
            <span className={styles.readout}>{leftT}</span>
          </div>

          <div className={styles.turretCol}>
            <HoldButton
              className={`${styles.ctrlBtn} ${styles.turretBtn}`}
              activeClassName={styles.ctrlActive}
              keys={['q', 'Q']}
              onStart={() => setPort(turret[0], -100)}
              onStop={() => stopGroup(turret)}
            >
              ⟲ CCW (Q)
            </HoldButton>
            <HoldButton
              className={`${styles.ctrlBtn} ${styles.turretBtn}`}
              activeClassName={styles.ctrlActive}
              keys={['r', 'R']}
              onStart={() => setPort(turret[0], 100)}
              onStop={() => stopGroup(turret)}
            >
              ⟳ CW (R)
            </HoldButton>
            <div style={{ display: 'flex', gap: 8 }}>
              <HoldButton
                className={`${styles.ctrlBtn} ${styles.turretBtn}`}
                activeClassName={styles.ctrlActive}
                onStart={turnLeft}
                onStop={restore}
              >
                ◄ Belok
              </HoldButton>
              <HoldButton
                className={`${styles.ctrlBtn} ${styles.turretBtn}`}
                activeClassName={styles.ctrlActive}
                onStart={turnRight}
                onStop={restore}
              >
                Belok ►
              </HoldButton>
            </div>
          </div>

          <div className={styles.throttle}>
            <input
              className={styles.throttleSlider}
              type="range" min={-100} max={100} value={rightT}
              onChange={(e) => applyRight(Number(e.target.value))}
            />
            <span className={styles.throttleLabel}>Kanan (E/D)</span>
            <span className={styles.readout}>{rightT}</span>
          </div>
        </div>
      </div>
    </ControlLayout>
  );
}
