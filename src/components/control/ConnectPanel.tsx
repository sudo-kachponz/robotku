// src/components/control/ConnectPanel.tsx
//
// Connect panel — capability detection (Web Bluetooth / Web Serial) + connect
// actions. Degrades gracefully on Safari/Firefox/iOS with a "buka di Chrome/Edge"
// notice. Reuses the framework-agnostic connection use-cases.

import { useEffect, useState } from 'react';
import { isBleSupported, isSerialSupported, type TransportKind } from '../../transport';
import { connect, disconnect, provisionWifi, connectWifi, onTelemetry } from '../../app/connection';
import { useConnection } from '../../hooks/useConnection';
import UnsupportedBrowserModal from './UnsupportedBrowserModal';
import styles from './ConnectPanel.module.css';

export default function ConnectPanel({ onClose }: { onClose: () => void }) {
  const { connState, robotInfo } = useConnection();
  const [caps, setCaps] = useState({ ble: false, serial: false });
  const [busy, setBusy] = useState<TransportKind | null>(null);
  const [showUnsupportedModal, setShowUnsupportedModal] = useState(false);

  // Capability detection must run client-side only (navigator is undefined on
  // the server) — otherwise SSR/hydration would disagree.
  useEffect(() => {
    setCaps({ ble: isBleSupported(), serial: isSerialSupported() });
  }, []);

  const anySupported = caps.ble || caps.serial;
  const isConnected = connState === 'connected';

  async function handleConnect(kind: TransportKind) {
    if (kind === 'ble' && !caps.ble) {
      setShowUnsupportedModal(true);
      return;
    }

    setBusy(kind);
    try {
      await connect(kind);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (kind === 'ble' && (msg.includes('Bluetooth') || !navigator.bluetooth)) {
        setShowUnsupportedModal(true);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
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
                disabled={busy !== null}
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
                <div
                  className={styles.unsupported}
                  onClick={() => setShowUnsupportedModal(true)}
                  style={{ cursor: 'pointer' }}
                >
                  Browser ini belum mendukung Web Bluetooth / Web Serial.{' '}
                  <span style={{ textDecoration: 'underline', color: 'var(--pink-400)' }}>
                    Lihat detail error
                  </span>
                </div>
              )}
            </div>
          )}

          <WifiSection isConnected={isConnected} onClose={onClose} />
        </div>
      </div>

      <UnsupportedBrowserModal
        isOpen={showUnsupportedModal}
        onClose={() => setShowUnsupportedModal(false)}
      />
    </>
  );
}

function WifiSection({ isConnected, onClose }: { isConnected: boolean; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [host, setHost] = useState('robotku.local');
  const [sent, setSent] = useState(false);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [busy, setBusy] = useState<'provision' | 'connect' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // Robot reports WIFI_STATUS{connected,ip} once it joins — capture the IP.
  useEffect(() => {
    const off = onTelemetry((m: { command?: string; connected?: boolean; ip?: string }) => {
      if (m?.command === 'WIFI_STATUS' && m.connected && m.ip) {
        setDetectedIp(m.ip);
        setHost(m.ip);
      }
    });
    return off;
  }, []);

  const provision = async () => {
    setBusy('provision');
    setErr(null);
    try {
      await provisionWifi(ssid, pass);
      setSent(true);
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(null);
    }
  };
  const doConnect = async () => {
    setBusy('connect');
    setErr(null);
    try {
      await connectWifi(host);
      onClose();
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.wifiSection}>
      <button className={styles.wifiToggle} onClick={() => setOpen((v) => !v)} type="button">
        <WifiIcon />
        <span>WiFi (beta)</span>
        <span className={styles.wifiChevron}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className={styles.wifiBody}>
          {isConnected ? (
            <>
              <label className={styles.wifiLabel}>Nama WiFi (SSID)</label>
              <input
                className={styles.wifiInput}
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="WiFi rumah / sekolah"
              />
              <label className={styles.wifiLabel}>Password</label>
              <input
                className={styles.wifiInput}
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
              <button
                className={styles.wifiBtn}
                disabled={!ssid || busy !== null}
                onClick={provision}
                type="button"
              >
                {busy === 'provision' ? 'Mengirim…' : 'Kirim WiFi ke robot'}
              </button>
              {sent && !detectedIp && (
                <div className={styles.wifiNote}>Terkirim — menunggu robot gabung WiFi…</div>
              )}
              {detectedIp && <div className={styles.wifiOk}>Robot online di {detectedIp} ✓</div>}
            </>
          ) : (
            <div className={styles.wifiNote}>
              Sambungkan dulu via Bluetooth/USB untuk mengirim nama WiFi ke robot — atau isi
              alamat di bawah kalau robot sudah tersambung WiFi.
            </div>
          )}

          <label className={styles.wifiLabel}>Alamat robot</label>
          <input
            className={styles.wifiInput}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="robotku.local atau 192.168.x.x"
          />
          <button
            className={`${styles.wifiBtn} ${styles.wifiConnect}`}
            disabled={!host || busy !== null}
            onClick={doConnect}
            type="button"
          >
            {busy === 'connect' ? 'Menyambung…' : 'Sambung via WiFi'}
          </button>
          {err && <div className={styles.wifiErr}>{err}</div>}
          <div className={styles.wifiHint}>
            WiFi (ws://) hanya jalan dari halaman http/localhost atau yang dilayani robot — bukan
            dari https.
          </div>
        </div>
      )}
    </div>
  );
}

function WifiIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14 0" />
      <path d="M8.5 16.1a6 6 0 0 1 7 0" />
      <circle cx="12" cy="19.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function BluetoothIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M7 7l10 10-5 5V2l5 5L7 17" />
    </svg>
  );
}

function UsbIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
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
