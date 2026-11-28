// src/components/control/ConnectPanel.tsx
//
// Connect panel. Two paths:
//  - "Online (lewat internet)": robot already set up -> type its relay code or the
//    hardware password from the box (or one tap on the last robot) -> relay.
//  - "Setup robot (sekali saja)": power-bank robot, no WiFi yet. 1) link it briefly
//    over Bluetooth/USB, 2) relay code: the robot's own (HELLO_ACK diag.relayId) or
//    claimed with the hardware password, 3) send WiFi, wait until the robot is on the
//    relay, 4) switch to the internet link (OTA updates work from there).
// Degrades gracefully on Safari/Firefox/iOS with a "buka di Chrome/Edge" notice.

import { useEffect, useState, useCallback } from 'react';
import { isBleSupported, isSerialSupported, type TransportKind } from '../../transport';
import {
  connect,
  disconnect,
  provisionWifi,
  provisionRelay,
  connectWifi,
  connectRelay,
  onTelemetry,
  getSavedLink,
} from '../../app/connection';
import { getState } from '../../app/store';
import { helloLine } from '../../domain/protocol';
import { RELAY_ID_RE, normalizeRobotPassword } from '../../domain/protocol';
import { useConnection } from '../../hooks/useConnection';
import UnsupportedBrowserModal from './UnsupportedBrowserModal';
import styles from './ConnectPanel.module.css';

export default function ConnectPanel({ onClose }: { onClose: () => void }) {
  const { connState, robotInfo, transport } = useConnection();
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
  // Linked over Bluetooth/USB = the robot is right here: show the setup steps.
  const localLink = isConnected && (transport?.kind === 'ble' || transport?.kind === 'serial');

  // Setup links stay open (the panel continues with the relay + WiFi steps).
  async function handleConnect(kind: TransportKind) {
    if (kind === 'ble' && !caps.ble) {
      setShowUnsupportedModal(true);
      return;
    }

    setBusy(kind);
    try {
      await connect(kind);
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

          {localLink ? (
            <div className={styles.body}>
              <RobotSetup onClose={onClose} />
            </div>
          ) : isConnected ? (
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
              <RelaySection onClose={onClose} />

              <div className={styles.sectionDivider}>
                <span>setup robot (sekali saja)</span>
              </div>
              <div className={styles.wifiNote}>
                Robot baru atau belum tersambung WiFi? Nyalakan robot (boleh pakai power bank), lalu
                sambungkan sebentar lewat Bluetooth atau USB.
              </div>

              <button
                className={`${styles.btn} ${styles.bleBtn}`}
                disabled={busy !== null}
                onClick={() => handleConnect('ble')}
              >
                <BluetoothIcon />
                <span>{busy === 'ble' ? 'Menyambungkan…' : '1. Sambung via Bluetooth'}</span>
              </button>

              <button
                className={`${styles.btn} ${styles.serialBtn}`}
                disabled={!caps.serial || busy !== null}
                onClick={() => handleConnect('serial')}
              >
                <UsbIcon />
                <span>{busy === 'serial' ? 'Menyambungkan…' : '1. Sambung via USB'}</span>
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

          {/* Direct WiFi (ws://) only works from http/localhost, never from the https site. */}
          {!isHttpsPage() && <WifiSection isConnected={isConnected} onClose={onClose} />}
        </div>
      </div>

      <UnsupportedBrowserModal
        isOpen={showUnsupportedModal}
        onClose={() => setShowUnsupportedModal(false)}
      />
    </>
  );
}

function RelaySection({ onClose }: { onClose: () => void }) {
  const [robotCode, setRobotCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Password XXXX-XXXX-XXXX-XXXX (preferred) or the old 6-char robot code.
  const handleInput = useCallback((val: string) => {
    setRobotCode(
      val
        .toUpperCase()
        .replace(/[^0-9A-Z-]/g, '')
        .slice(0, 19),
    );
    setErr(null);
  }, []);

  // Warn about confusing characters
  const hasConfusing = /[01IO]/.test(robotCode);
  const isValid = RELAY_ID_RE.test(robotCode) || normalizeRobotPassword(robotCode) !== null;

  const saved = typeof window !== 'undefined' ? getSavedLink() : null;

  const doConnect = async (input = robotCode) => {
    setBusy(true);
    setErr(null);
    try {
      await connectRelay(input);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: 'var(--ink-800)' }}>
        Online (lewat internet)
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.4, marginBottom: 8 }}>
        Masukkan password robot dari kartu di dalam box (atau kode robot 6 karakter).
      </div>
      {saved && (
        <button
          className={styles.wifiBtn}
          disabled={busy}
          onClick={() => doConnect(saved.id)}
          type="button"
          style={{ width: '100%', marginBottom: 8 }}
        >
          Sambung lagi ke robot{' '}
          <b style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{saved.id}</b>
        </button>
      )}
      <input
        className={styles.wifiInput}
        value={robotCode}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        maxLength={19}
        style={{
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: '0.15em',
          fontFamily: 'monospace',
        }}
        autoComplete="off"
        spellCheck={false}
      />
      {hasConfusing && robotCode.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>
          Password/kode robot tidak mengandung 0, 1, I, atau O. Mungkin maksudnya huruf/angka lain?
        </div>
      )}
      <button
        className={styles.wifiBtn}
        disabled={!isValid || busy}
        onClick={() => doConnect()}
        type="button"
        style={{ width: '100%', marginTop: 8, background: 'var(--green)' }}
      >
        {busy ? 'Menyambung…' : 'Sambung via Relay'}
      </button>
      {err && <div className={styles.wifiErr}>{err}</div>}
    </div>
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
  const [isHttps, setIsHttps] = useState(false);
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsHttps(window.isSecureContext && location.protocol === 'https:');
    }
  }, []);

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
          {isHttps && (
            <div className={styles.unsupported} style={{ marginBottom: 6 }}>
              Halaman https tidak bisa membuka ws://. WiFi langsung hanya jalan dari
              http://localhost atau halaman yang dilayani robot. Gunakan <b>Relay</b> untuk
              mengendalikan dari situs ini.
            </div>
          )}
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
              Sambungkan dulu via Bluetooth/USB untuk mengirim nama WiFi ke robot — atau isi alamat
              di bawah kalau robot sudah tersambung WiFi.
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
            disabled={!host || busy !== null || isHttps}
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

const isHttpsPage = () =>
  typeof window !== 'undefined' && window.isSecureContext && location.protocol === 'https:';

/** Steps 2-4 of the setup, shown while the robot is linked over Bluetooth/USB. */
function RobotSetup({ onClose }: { onClose: () => void }) {
  const { robotInfo, transport } = useConnection();
  const diag = robotInfo?.diag ?? {};
  const robotRelayId =
    typeof diag.relayId === 'string' && RELAY_ID_RE.test(diag.relayId) ? diag.relayId : '';
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const relayId = claimedId ?? robotRelayId;
  const relayOnline = diag.relay === true;

  const [password, setPassword] = useState('');
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState<'relay' | 'wifi' | 'switch' | null>(null);
  const [wifi, setWifi] = useState<'idle' | 'sent' | 'up'>('idle');
  const [wifiIp, setWifiIp] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // The robot reports WIFI_STATUS {connected, ip} once it joins the network.
  useEffect(
    () =>
      onTelemetry((m: { command?: string; connected?: boolean; ip?: string }) => {
        if (m?.command === 'WIFI_STATUS' && m.connected) {
          setWifi('up');
          if (m.ip) setWifiIp(m.ip);
        }
      }),
    [],
  );

  // After WiFi is sent, re-HELLO every 3 s: HELLO_ACK diag.relay says when the robot is on the relay.
  useEffect(() => {
    if (wifi === 'idle' || relayOnline) return;
    const id = setInterval(() => {
      void getState()
        .transport?.sendLine(helloLine())
        .catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [wifi, relayOnline]);

  const claim = async () => {
    setBusy('relay');
    setErr(null);
    try {
      setClaimedId(await provisionRelay(password));
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(null);
    }
  };
  const sendWifi = async () => {
    setBusy('wifi');
    setErr(null);
    try {
      await provisionWifi(ssid, pass);
      setWifi('sent');
    } catch (e) {
      setErr(msg(e));
    } finally {
      setBusy(null);
    }
  };
  const switchToInternet = async () => {
    setBusy('switch');
    setErr(null);
    try {
      await disconnect(); // free the Bluetooth/USB link
      await connectRelay(relayId);
      onClose();
    } catch (e) {
      setErr(msg(e));
      setBusy(null);
    }
  };

  const step = (n: number, done: boolean, title: string) => (
    <div className={styles.setupStep}>
      <span className={done ? styles.setupNumDone : styles.setupNum}>{done ? '✓' : n}</span>
      {title}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {step(
        1,
        true,
        `Robot tersambung via ${transport?.kind === 'ble' ? 'Bluetooth' : 'USB'} · fw ${robotInfo?.fwVersion ?? '?'}`,
      )}

      {step(2, !!relayId, 'Kode relay robot')}
      {relayId ? (
        <div className={styles.wifiOk}>
          Kode relay: <b className={styles.setupCode}>{relayId}</b> — catat kode ini.
        </div>
      ) : (
        <>
          <div className={styles.wifiNote}>
            Masukkan kode hardware dari kartu di dalam box robot.
          </div>
          <input
            className={styles.wifiInput}
            value={password}
            onChange={(e) => setPassword(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            style={{ fontFamily: 'monospace', letterSpacing: '0.08em', textAlign: 'center' }}
          />
          <button
            className={styles.wifiBtn}
            disabled={busy !== null || !password.trim()}
            onClick={claim}
            type="button"
          >
            {busy === 'relay' ? 'Mengambil kode…' : 'Ambil kode relay'}
          </button>
        </>
      )}

      {step(3, relayOnline, 'Sambungkan robot ke WiFi')}
      {relayId && !relayOnline && (
        <>
          <label className={styles.wifiLabel}>Nama WiFi (2.4 GHz)</label>
          <input
            className={styles.wifiInput}
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="WiFi rumah / sekolah / hotspot HP"
          />
          <label className={styles.wifiLabel}>Password WiFi</label>
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
            onClick={sendWifi}
            type="button"
          >
            {busy === 'wifi' ? 'Mengirim…' : 'Kirim WiFi ke robot'}
          </button>
          {wifi === 'sent' && (
            <div className={styles.wifiNote}>Terkirim — robot sedang masuk WiFi…</div>
          )}
          {wifi === 'up' && (
            <div className={styles.wifiNote}>
              Robot masuk WiFi{wifiIp ? ` (${wifiIp})` : ''} ✓ — menunggu tersambung ke internet…
            </div>
          )}
        </>
      )}
      {relayOnline && <div className={styles.wifiOk}>Robot online di internet ✓</div>}

      {step(4, false, 'Kendalikan lewat internet')}
      <button
        className={styles.wifiBtn}
        disabled={!relayOnline || busy !== null}
        onClick={switchToInternet}
        type="button"
        style={{ background: 'var(--green)' }}
      >
        {busy === 'switch' ? 'Memindahkan…' : 'Pindah ke internet (relay)'}
      </button>
      <div className={styles.wifiHint}>
        Setelah ini kabel/Bluetooth tidak perlu lagi: robot cukup pakai power bank, dan update
        firmware jalan lewat WiFi (OTA).
      </div>
      {err && <div className={styles.wifiErr}>{err}</div>}

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
  );
}

function WifiIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
