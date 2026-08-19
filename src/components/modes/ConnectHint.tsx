// src/components/modes/ConnectHint.tsx
//
// Shown in a mode when disconnected: controls still render but send nothing.

import { useConnection } from '../../hooks/useConnection';
import styles from '../../styles/ModeControls.module.css';

export default function ConnectHint() {
  const { connState } = useConnection();
  if (connState === 'connected') return null;
  return <div className={styles.connectHint}>Connect dulu untuk mengendalikan robot.</div>;
}
