// src/components/control/ConnectionBadge.tsx
//
// Top-center connection badge. Red "NO DEVICE CONNECTED" or green
// "CONNECTED · <board> · fw <ver>". Reads the shared store via useConnection.

import { useConnection } from '../../hooks/useConnection';
import styles from './ConnectionBadge.module.css';

export default function ConnectionBadge() {
  const { connState, robotInfo } = useConnection();

  if (connState === 'connected' && robotInfo) {
    return (
      <div className={`${styles.badge} ${styles.connected}`}>
        <span className={styles.dot} />
        CONNECTED · {robotInfo.board} · fw {robotInfo.fwVersion}
      </div>
    );
  }

  if (connState === 'connecting') {
    return (
      <div className={`${styles.badge} ${styles.connecting}`}>
        <span className={styles.dot} />
        MENYAMBUNGKAN…
      </div>
    );
  }

  if (connState === 'error') {
    return (
      <div className={`${styles.badge} ${styles.error}`}>
        <span className={styles.dot} />
        KONEKSI TERPUTUS
      </div>
    );
  }

  return (
    <div className={`${styles.badge} ${styles.disconnected}`}>
      <span className={styles.dot} />
      NO DEVICE CONNECTED
    </div>
  );
}
