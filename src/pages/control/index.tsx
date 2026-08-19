// src/pages/control/index.tsx
//
// "Let's Get Started" — Robotku mascot + big Connect button. After connecting
// (or to explore first) the user proceeds to the Control Modes carousel.

import { useState } from 'react';
import { useRouter } from 'next/router';
import ControlLayout from '../../components/control/ControlLayout';
import ConnectPanel from '../../components/control/ConnectPanel';
import { useConnection } from '../../hooks/useConnection';
import styles from '../../styles/ControlHome.module.css';

export default function ControlStart() {
  const router = useRouter();
  const { connState } = useConnection();
  const [panelOpen, setPanelOpen] = useState(false);
  const connected = connState === 'connected';

  return (
    <ControlLayout>
      <div className={styles.wrap}>
        <img
          className={styles.logo}
          src="/brand/Robotku-Mascot-Logo-Horizontal.png"
          alt="Robotku"
        />
        <img className={styles.mascot} src="/brand/Pose1.png" alt="Maskot Robotku" />

        <h1 className={styles.title}>Ayo Mulai!</h1>
        <p className={styles.subtitle}>
          Klik Connect untuk langsung mengendalikan robotmu. Jelajahi mode dan
          coba coding!
        </p>

        <div className={styles.actions}>
          <button
            className={`${styles.cta} ${connected ? styles.ctaConnected : ''}`}
            onClick={() => (connected ? router.push('/control/modes') : setPanelOpen(true))}
          >
            {connected ? 'Lanjut ke Mode →' : 'Connect'}
          </button>
          <button
            className={styles.secondary}
            onClick={() => router.push('/control/modes')}
          >
            Jelajahi Mode
          </button>
        </div>
      </div>

      {panelOpen && <ConnectPanel onClose={() => setPanelOpen(false)} />}
    </ControlLayout>
  );
}
