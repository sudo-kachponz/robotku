// src/components/control/ConnectPanel.tsx
//
// Connect panel. Two paths:
//  - "Online (lewat internet)": robot already set up -> type its relay code or the
//    hardware password from the box (or one tap on the last robot) -> relay.
//  - Setup slides (picture + explanation + action per step) for a robot without WiFi:
//    1) power it (power bank), 2) link it briefly over Bluetooth/USB, 3) relay code:
//    the robot's own (HELLO_ACK diag.relayId) or claimed with the hardware password,
//    4) send WiFi and wait until it is on the relay, 5) switch to the internet link
//    (OTA updates work from there).
// Degrades gracefully on Safari/Firefox/iOS with a "buka di Chrome/Edge" notice.

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { RELAY_ID_RE, normalizeRobotPassword, helloLine } from '../../domain/protocol';
import { useConnection } from '../../hooks/useConnection';
import UnsupportedBrowserModal from './UnsupportedBrowserModal';
import SetupArt, { type Scene } from './SetupArt';
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

          {isConnected && !localLink ? (
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
              {!localLink && <RelaySection onClose={onClose} />}
              {!localLink && (
                <div className={styles.sectionDivider}>
                  <span>robot baru? setup dulu</span>
                </div>
              )}
              <SetupSlides
                localLink={localLink}
                busy={busy}
                canSerial={caps.serial}
                onConnect={handleConnect}
                onClose={onClose}
              />
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

const SLIDES: { scene: Scene; title: string; desc: string }[] = [
  {
    scene: 'power',
    title: 'Nyalakan robot',
    desc: 'Colok kabel USB-C robot ke power bank. Lampu POWER menyala merah dan layar OLED menampilkan logo Robotku.',
  },
  {
    scene: 'link',
    title: 'Sambungkan sebentar',
    desc: 'Cuma untuk setup pertama, supaya robot bisa menerima nama WiFi. Pilih Bluetooth (robot tetap di power bank) atau colok kabel USB robot ke laptop. Pakai Chrome atau Edge.',
  },
  {
    scene: 'code',
    title: 'Kode relay robot',
    desc: 'Kode relay adalah alamat robotmu di internet. Robot yang sudah pernah di-setup punya kodenya sendiri; robot baru memakai kode hardware dari kartu di dalam box.',
  },
  {
    scene: 'wifi',
    title: 'Masukkan WiFi',
    desc: 'Robot butuh WiFi 2.4 GHz: WiFi rumah, sekolah, atau hotspot HP. Nama dan password dikirim lewat sambungan di langkah 2.',
  },
  {
    scene: 'internet',
    title: 'Kendalikan dari mana saja',
    desc: 'Robot sudah online. Kabel dan Bluetooth tidak perlu lagi: buka situs ini di HP atau laptop mana pun dan masukkan kode relay. Update firmware juga lewat WiFi (OTA).',
  },
];

/**
 * Robot setup as swipeable slides (scroll-snap; swipe on touch, arrows/dots on desktop).
 * Each slide: picture, explanation, and the action for that step. The deck jumps ahead
 * by itself as steps complete (linked -> code -> WiFi -> online).
 */
function SetupSlides({
  localLink,
  busy,
  canSerial,
  onConnect,
  onClose,
}: {
  localLink: boolean;
  busy: TransportKind | null;
  canSerial: boolean;
  onConnect: (kind: TransportKind) => void;
  onClose: () => void;
}) {
  const { robotInfo, transport } = useConnection();
  const diag = robotInfo?.diag ?? {};
  const robotRelayId =
    typeof diag.relayId === 'string' && RELAY_ID_RE.test(diag.relayId) ? diag.relayId : '';
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const relayId = localLink ? (claimedId ?? robotRelayId) : '';
  const relayOnline = localLink && diag.relay === true;

  const [index, setIndex] = useState(0);
  const goTo = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, i))),
    [],
  );
  // Swipe: a mostly-horizontal drag of 50 px+ flips one slide (taps still click).
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const [password, setPassword] = useState('');
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [work, setWork] = useState<'relay' | 'wifi' | 'switch' | null>(null);
  const [wifi, setWifi] = useState<'idle' | 'sent' | 'up'>('idle');
  const [wifiIp, setWifiIp] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // Jump to the next open step as soon as one completes.
  useEffect(() => {
    if (relayOnline) goTo(4);
    else if (localLink && relayId) goTo(3);
    else if (localLink) goTo(2);
  }, [localLink, relayId, relayOnline, goTo]);

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

  const run = async (kind: 'relay' | 'wifi' | 'switch', fn: () => Promise<void>) => {
    setWork(kind);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(msg(e));
    } finally {
      setWork(null);
    }
  };
  const claim = () => run('relay', async () => setClaimedId(await provisionRelay(password)));
  const sendWifi = () =>
    run('wifi', async () => {
      await provisionWifi(ssid, pass);
      setWifi('sent');
    });
  const switchToInternet = () =>
    run('switch', async () => {
      await disconnect(); // free the Bluetooth/USB link
      await connectRelay(relayId);
      onClose();
    });

  const needLink = (
    <div className={styles.wifiNote}>
      Sambungkan robot dulu di{' '}
      <button type="button" className={styles.linkBtn} onClick={() => goTo(1)}>
        langkah 2
      </button>
      .
    </div>
  );

  const actions = [
    // 1 — power on
    <button key="a1" type="button" className={styles.wifiBtn} onClick={() => goTo(1)}>
      Sudah menyala, lanjut →
    </button>,

    // 2 — Bluetooth / USB
    localLink ? (
      <div key="a2" className={styles.wifiOk}>
        ✓ Tersambung via {transport?.kind === 'ble' ? 'Bluetooth' : 'USB'} · fw{' '}
        {robotInfo?.fwVersion ?? '?'}
      </div>
    ) : (
      <div key="a2" className={styles.slideActions}>
        <button
          className={`${styles.btn} ${styles.bleBtn}`}
          disabled={busy !== null}
          onClick={() => onConnect('ble')}
        >
          <BluetoothIcon />
          <span>{busy === 'ble' ? 'Menyambungkan…' : 'Bluetooth'}</span>
        </button>
        <button
          className={`${styles.btn} ${styles.serialBtn}`}
          disabled={!canSerial || busy !== null}
          onClick={() => onConnect('serial')}
        >
          <UsbIcon />
          <span>{busy === 'serial' ? 'Menyambungkan…' : 'Kabel USB'}</span>
        </button>
        <div className={styles.wifiHint}>
          Robot tidak muncul di daftar Bluetooth? Pastikan robot menyala. Di Chrome Linux, aktifkan
          dulu chrome://flags/#enable-experimental-web-platform-features.
        </div>
      </div>
    ),

    // 3 — relay code
    !localLink ? (
      <div key="a3">{needLink}</div>
    ) : relayId ? (
      <div key="a3" className={styles.wifiOk}>
        Kode relay: <b className={styles.setupCode}>{relayId}</b> — catat kode ini.
      </div>
    ) : (
      <div key="a3" className={styles.slideActions}>
        <input
          className={styles.wifiInput}
          value={password}
          onChange={(e) => setPassword(e.target.value.toUpperCase())}
          placeholder="Kode hardware XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          style={{ fontFamily: 'monospace', letterSpacing: '0.06em', textAlign: 'center' }}
        />
        <button
          className={styles.wifiBtn}
          disabled={work !== null || !password.trim()}
          onClick={claim}
          type="button"
        >
          {work === 'relay' ? 'Mengambil kode…' : 'Ambil kode relay'}
        </button>
      </div>
    ),

    // 4 — WiFi
    !localLink ? (
      <div key="a4">{needLink}</div>
    ) : relayOnline ? (
      <div key="a4" className={styles.wifiOk}>
        ✓ Robot sudah online di internet
      </div>
    ) : !relayId ? (
      <div key="a4" className={styles.wifiNote}>
        Isi kode relay dulu di{' '}
        <button type="button" className={styles.linkBtn} onClick={() => goTo(2)}>
          langkah 3
        </button>
        .
      </div>
    ) : (
      <div key="a4" className={styles.slideActions}>
        <input
          className={styles.wifiInput}
          value={ssid}
          onChange={(e) => setSsid(e.target.value)}
          placeholder="Nama WiFi"
          aria-label="Nama WiFi (2.4 GHz)"
        />
        <input
          className={styles.wifiInput}
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Password WiFi"
          aria-label="Password WiFi"
        />
        <button
          className={styles.wifiBtn}
          disabled={!ssid || work !== null}
          onClick={sendWifi}
          type="button"
        >
          {work === 'wifi' ? 'Mengirim…' : 'Kirim WiFi ke robot'}
        </button>
        {wifi === 'sent' && (
          <div className={styles.wifiNote}>Terkirim — robot sedang masuk WiFi…</div>
        )}
        {wifi === 'up' && (
          <div className={styles.wifiNote}>
            Robot masuk WiFi{wifiIp ? ` (${wifiIp})` : ''} ✓ — menunggu tersambung ke internet…
          </div>
        )}
      </div>
    ),

    // 5 — switch to the relay
    <div key="a5" className={styles.slideActions}>
      {relayOnline && <div className={styles.wifiOk}>✓ Robot online · kode {relayId}</div>}
      <button
        className={styles.wifiBtn}
        disabled={!relayOnline || work !== null}
        onClick={switchToInternet}
        type="button"
        style={{ background: 'var(--green)' }}
      >
        {work === 'switch' ? 'Memindahkan…' : 'Pindah ke internet (relay)'}
      </button>
      {!relayOnline && (
        <div className={styles.wifiNote}>Aktif setelah robot online (langkah 4).</div>
      )}
    </div>,
  ];

  return (
    <div className={styles.slidesWrap}>
      <div
        className={styles.slides}
        onPointerDown={(e) => {
          swipeStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const st = swipeStart.current;
          swipeStart.current = null;
          if (!st) return;
          const dx = e.clientX - st.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - st.y))
            goTo(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {SLIDES.map((s, i) => (
            <section
              key={s.scene}
              className={styles.slide}
              aria-label={`Langkah ${i + 1} dari ${SLIDES.length}: ${s.title}`}
              aria-hidden={i !== index}
            >
              <span className={styles.stepBadge}>Langkah {String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.slideTitle}>{s.title}</h3>
              <div className={styles.slideArt}>
                <SetupArt scene={s.scene} />
              </div>
              <p className={styles.slideDesc}>{s.desc}</p>
              {actions[i]}
            </section>
          ))}
        </div>
      </div>

      {err && <div className={styles.wifiErr}>{err}</div>}

      <div className={styles.slideNav}>
        <button
          type="button"
          className={styles.navArrow}
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Langkah sebelumnya"
        >
          ‹
        </button>
        <div className={styles.dots} role="tablist" aria-label="Langkah setup">
          {SLIDES.map((s, i) => (
            <button
              key={s.scene}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Langkah ${i + 1}: ${s.title}`}
              className={i === index ? styles.dotOn : styles.dot}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.navArrow}
          onClick={() => goTo(index + 1)}
          disabled={index === SLIDES.length - 1}
          aria-label="Langkah berikutnya"
        >
          ›
        </button>
      </div>

      {localLink && (
        <button
          className={`${styles.btn} ${styles.disconnectBtn}`}
          onClick={async () => {
            await disconnect();
            onClose();
          }}
        >
          Putuskan
        </button>
      )}
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
