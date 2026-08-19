// src/components/modes/BaseMode.tsx
//
// Base Robot — D-pad drive + Grab/Release. Uses the shared transport via useDrive
// and the Base port mapping from settings. Keybinds: W/↑ S/↓ A/← D/→, Grab Q, Release E.

import ControlLayout from '../control/ControlLayout';
import HoldButton from './HoldButton';
import ConnectHint from './ConnectHint';
import { useDrive, useSettings } from '../../hooks/useDrive';
import styles from '../../styles/ModeControls.module.css';

const DRIVE = 100;

export default function BaseMode() {
  const { driveGroup, stopGroup, setGripper } = useDrive();
  const { mapping } = useSettings();
  const { left, right, arms } = mapping.base;

  const forward = () => { driveGroup(left, DRIVE); driveGroup(right, DRIVE); };
  const backward = () => { driveGroup(left, -DRIVE); driveGroup(right, -DRIVE); };
  const turnLeft = () => { driveGroup(left, -DRIVE); driveGroup(right, DRIVE); };
  const turnRight = () => { driveGroup(left, DRIVE); driveGroup(right, -DRIVE); };
  const stopWheels = () => { stopGroup(left); stopGroup(right); };

  const grab = () => { setGripper(false); driveGroup(arms, DRIVE); };
  const release = () => { setGripper(true); driveGroup(arms, -DRIVE); };
  const stopArms = () => stopGroup(arms);

  return (
    <ControlLayout title="Base Robot">
      <ConnectHint />
      <div className={styles.wrap}>
        <div className={styles.dpad}>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.dUp}`}
            activeClassName={styles.ctrlActive}
            keys={['w', 'W', 'ArrowUp']}
            onStart={forward}
            onStop={stopWheels}
            ariaLabel="Maju"
          >
            <Arrow dir="up" />
          </HoldButton>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.dLeft}`}
            activeClassName={styles.ctrlActive}
            keys={['a', 'A', 'ArrowLeft']}
            onStart={turnLeft}
            onStop={stopWheels}
            ariaLabel="Belok kiri"
          >
            <Arrow dir="left" />
          </HoldButton>
          <div className={styles.dCenter}>BASE</div>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.dRight}`}
            activeClassName={styles.ctrlActive}
            keys={['d', 'D', 'ArrowRight']}
            onStart={turnRight}
            onStop={stopWheels}
            ariaLabel="Belok kanan"
          >
            <Arrow dir="right" />
          </HoldButton>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.dDown}`}
            activeClassName={styles.ctrlActive}
            keys={['s', 'S', 'ArrowDown']}
            onStart={backward}
            onStop={stopWheels}
            ariaLabel="Mundur"
          >
            <Arrow dir="down" />
          </HoldButton>
        </div>

        <div className={styles.armRow}>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.armBtn}`}
            activeClassName={styles.ctrlActive}
            keys={['q', 'Q']}
            onStart={grab}
            onStop={stopArms}
          >
            🤖 Grab (Q)
          </HoldButton>
          <HoldButton
            className={`${styles.ctrlBtn} ${styles.armBtn}`}
            activeClassName={styles.ctrlActive}
            keys={['e', 'E']}
            onStart={release}
            onStop={stopArms}
          >
            ✋ Release (E)
          </HoldButton>
        </div>
      </div>
    </ControlLayout>
  );
}

function Arrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M12 4l7 8h-4v8h-6v-8H5z" />
    </svg>
  );
}
