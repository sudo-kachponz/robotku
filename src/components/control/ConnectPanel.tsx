// src/components/control/ConnectPanel.tsx
//
// Connect panel — capability detection (Web Bluetooth / Web Serial) + connect
// actions. Degrades gracefully on Safari/Firefox/iOS with a "buka di Chrome/Edge"
// notice. Reuses the framework-agnostic connection use-cases.

import { useEffect, useState } from 'react';
import {
  isBleSupported,
  isSerialSupported,
  type TransportKind,
} from '../../transport';
import { connect, disconnect } from '../../app/connection';
import { useConnection } from '../../hooks/useConnection';
import styles from './ConnectPanel.module.css';

export default function ConnectPanel({ onClose }: { onClose: () => void }) {
  const { connState, robotInfo } = useConnection();
  const [caps, setCaps] = useState({ ble: false, serial: false });
  const [busy, setBusy] = useState<TransportKind | null>(null);

  // Capability detection must run client-side only (navigator is undefined on
  // the server) — otherwise SSR/hydration would disagree.
  useEffect(() => {
    setCaps({ ble: isBleSupported(), serial: isSerialSupported() });
  }, []);

  const anySupported = caps.ble || caps.serial;
  const isConnected = connState === 'connected';

  async function handleConnect(kind: TransportKind) {
    setBusy(kind);
    try {
      await connect(kind);
      onClose();
    } catch {
      // connection.ts already toasts the reason.
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Sambungkan robot"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Sambungkan Robot</h2>
          <button className={styles.close} onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        {isConnected ? (
          <div className={styles.body}>
            <div className={styles.connectedNote}>
              <span className={styles.okDot} />
              Tersambung ke <b>{robotInfo?.board}</b> · fw {robotInfo?.fwVersion}
            </div>
            <button
              className={`${styles.btn} ${styles.disconnectBtn}`}
              onClick={async () => {
                await disconnect();
                onClose();
              }}
            >
              Putuskan
            </button>
          </div>
        ) : (
          <div className={styles.body}>
            <button
              className={`${styles.btn} ${styles.bleBtn}`}
              disabled={!caps.ble || busy !== null}
              onClick={() => handleConnect('ble')}
            >
              <BluetoothIcon />
              <span>{busy === 'ble' ? 'Menyambungkan…' : 'Bluetooth'}</span>
            </button>

            <button
              className={`${styles.btn} ${styles.serialBtn}`}
              disabled={!caps.serial || busy !== null}
              onClick={() => handleConnect('serial')}
            >
              <UsbIcon />
              <span>{busy === 'serial' ? 'Menyambungkan…' : 'USB (Serial)'}</span>
            </button>

            {!anySupported && (
              <div className={styles.unsupported}>
                Browser ini belum mendukung Web Bluetooth / Web Serial. Buka di{' '}
                <b>Chrome</b> atau <b>Edge</b> (desktop) lewat HTTPS/localhost.
                Kamu tetap bisa memakai <b>Block Coding</b> di simulator.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BluetoothIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

function UsbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="20" r="1.5" />
      <path d="M12 18.5V4" />
      <path d="M9 7l3-3 3 3" />
      <path d="M12 12l-4 2v2" />
      <circle cx="8" cy="17" r="1.2" />
      <path d="M12 10l4 2v1" />
      <rect x="14.5" y="12.5" width="3" height="3" rx="0.6" />
    </svg>
  );
}
