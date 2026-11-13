// src/components/control/FirmwarePanel.tsx
//
// LEGO-style firmware updater: flashes the Robotku ESP32 over USB straight from
// the browser via ESP Web Tools (Web Serial). The flashable image is a single
// merged .bin (bootloader+partitions+boot_app0+app) hosted under /public/firmware
// with an ESP Web Tools manifest — see scripts note in the repo README.

import { useEffect, useState } from 'react';
import { createElement } from 'react';
import { useConnection } from '../../hooks/useConnection';
import {
  disconnect,
  fetchOtaManifest,
  onTelemetry,
  startOtaUpdate,
  type OtaManifest,
} from '../../app/connection';
import { showToast } from '../../ui/toast';
import styles from '../../styles/Settings.module.css';


// The three firmware types offered, each with its feature table.
// Prefix for the staging (/development) deploy so it serves its own firmware.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

const FEATURES = ['Bluetooth', 'WiFi', 'Relay (internet)', 'OTA update', 'Block coding', 'AI suara + mic'] as const;

interface Firmware {
  title: string;
  ver: string;
  manifest: string;
  chip: string;
  color: string;
  status: string;
  desc: string;
  feats: (boolean | string)[]; // aligned to FEATURES
  setup: string | null;
}

const FIRMWARES: Firmware[] = [
  {
    title: 'Bluetooth (stabil)', ver: '2.2.0-mk', manifest: '/firmware/manifest-ble.json', chip: 'ESP32',
    color: '#0284c7', status: '✅ teruji di hardware',
    desc: 'Paling aman. Kontrol lewat Bluetooth saja — tanpa WiFi, relay, atau OTA.',
    feats: [true, false, false, false, 'dasar', false], setup: null,
  },
  {
    title: 'OTA + Relay (lengkap)', ver: '2.4.3-mk', manifest: '/firmware/manifest.json', chip: 'ESP32',
    color: '#16a34a', status: '⚙️ compile — perlu tes hardware',
    desc: 'Semua fitur. Kontrol dari internet lewat relay + update firmware OTA.',
    feats: [true, true, true, true, true, true],
    setup: 'SET_RELAY <ID> <SECRET> lalu SET_WIFI <ssid> <pass> di Serial Monitor',
  },
  {
    title: 'ESP32-S3 (board baru)', ver: '2.4.3-s3', manifest: '/firmware/manifest-s3.json', chip: 'ESP32-S3',
    color: '#4f46e5', status: '🆕 board S3 v1.3 — belum ditest',
    desc: 'Firmware yang sama (semua fitur) untuk board ESP32-S3 v1.3.',
    feats: [true, true, true, true, true, true],
    setup: 'SET_RELAY <ID> <SECRET> lalu SET_WIFI <ssid> <pass> di Serial Monitor',
  },
];

const ESP_WEB_TOOLS = 'https://unpkg.com/esp-web-tools@10/dist/web/install-button.js';

type OtaState = 'idle' | 'updating' | 'done' | 'fail';
const OTA_FAIL_MSG: Record<string, string> = {
  wifi_down: 'Robot belum tersambung WiFi. Buka panel koneksi → kirim WiFi ke robot dulu.',
  same_version: 'Robot sudah di versi terbaru.',
  update_begin: 'Gagal menyiapkan slot OTA (ukuran file?).',
  write: 'Gagal menulis firmware (koneksi WiFi putus saat unduh?).',
};

export default function FirmwarePanel() {
  const { robotInfo, transport } = useConnection();
  const [supported, setSupported] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [manifest, setManifest] = useState<OtaManifest | null>(null);
  const [ota, setOta] = useState<OtaState>('idle');
  const [otaPct, setOtaPct] = useState(0);
  const [otaMsg, setOtaMsg] = useState<string | null>(null);

  // Latest firmware manifest (for the OTA version + .bin URL).
  useEffect(() => {
    void fetchOtaManifest().then(setManifest);
  }, []);

  // Watch OTA progress/result frames from the robot.
  useEffect(() => {
    const off = onTelemetry((m: { command?: string; pct?: number; reason?: string }) => {
      if (m?.command === 'OTA_PROGRESS') {
        setOta('updating');
        setOtaPct(typeof m.pct === 'number' ? m.pct : 0);
      } else if (m?.command === 'OTA_OK') {
        setOta('done');
        setOtaPct(100);
      } else if (m?.command === 'OTA_FAIL') {
        setOta('fail');
        setOtaMsg(OTA_FAIL_MSG[m.reason ?? ''] ?? `Gagal: ${m.reason ?? 'unknown'}`);
      }
    });
    return off;
  }, []);

  const otaVersion = manifest?.version ?? '2.4.2-mk';

  const doOta = async () => {
    if (!manifest) return;
    setOta('updating');
    setOtaPct(0);
    setOtaMsg(null);
    try {
      await startOtaUpdate(manifest.url, manifest.version);
    } catch (e) {
      setOta('fail');
      setOtaMsg(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    setSupported('serial' in navigator);
    if (document.querySelector(`script[data-espwebtools]`)) {
      setLoaded(true);
      return;
    }
    const s = document.createElement('script');
    s.type = 'module';
    s.src = ESP_WEB_TOOLS;
    s.dataset.espwebtools = '1';
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);

  const installed = robotInfo?.fwVersion ?? null;
  const upToDate = installed === otaVersion;
  const connected = !!transport;
  const hasOta = robotInfo?.capabilities?.includes('OTA_UPDATE') ?? false;
  // A live SERIAL link holds the USB port; ESP Web Tools can't open it until we let go.
  const serialBusy = transport?.kind === 'serial';

  const row = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 } as const;

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Firmware Robot</h2>
      <p className={styles.cardSub}>
        Perbarui firmware ESP32 langsung lewat kabel USB dari browser — seperti update di LEGO.
      </p>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}>
        <div style={row}>
          <span style={{ color: 'var(--ink-500)' }}>Versi terpasang</span>
          <strong>{installed ?? '— (sambungkan robot untuk cek)'}</strong>
        </div>
        <div style={{ ...row, borderTop: '1px solid var(--line-soft)' }}>
          <span style={{ color: 'var(--ink-500)' }}>Versi terbaru</span>
          <strong>
            {otaVersion}{' '}
            {installed && (upToDate ? '✓ sudah terbaru' : '· ada pembaruan')}
          </strong>
        </div>
      </div>

      {/* --- OTA update over WiFi (no cable). Robot downloads the .bin itself. --- */}
      {!hasOta && connected && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>
          Firmware ini tidak mendukung OTA WiFi. Gunakan USB untuk update.
        </div>
      )}
      <div
        style={{
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          display: hasOta || !connected ? undefined : 'none',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
          📡 Update via WiFi (OTA)
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>
          Tanpa kabel. Robot mengunduh firmware sendiri lewat WiFi — jalan dari hub.robotku.id.
          Syarat: robot tersambung (BLE/USB) <b>dan</b> sudah dikirimi WiFi (panel koneksi).
        </p>

        {ota === 'updating' && (
          <div style={{ marginBottom: 8 }}>
            <div
              style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${otaPct}%`,
                  background: 'var(--indigo-600)',
                  transition: 'width .2s',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>
              Mengunduh & memasang… {otaPct}%
            </div>
          </div>
        )}
        {ota === 'done' && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>
            ✓ Berhasil! Robot restart dengan firmware {otaVersion}.
          </div>
        )}
        {ota === 'fail' && otaMsg && (
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8, lineHeight: 1.5 }}>
            ⛔ {otaMsg}
          </div>
        )}

        <button
          onClick={doOta}
          disabled={!connected || !manifest || ota === 'updating' || (!!installed && upToDate)}
          style={{
            border: 'none',
            borderRadius: 'var(--r-full)',
            padding: '11px 20px',
            fontWeight: 800,
            fontSize: 14,
            cursor: !connected || ota === 'updating' ? 'not-allowed' : 'pointer',
            opacity: !connected || !manifest || (!!installed && upToDate) ? 0.5 : 1,
            background: 'var(--green)',
            color: '#fff',
            fontFamily: 'inherit',
          }}
        >
          {ota === 'updating'
            ? `Mengunduh… ${otaPct}%`
            : !connected
              ? 'Sambungkan robot dulu'
              : installed && upToDate
                ? '✓ Sudah terbaru'
                : '📡 Update via WiFi'}
        </button>
      </div>

      {serialBusy && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            background: 'var(--amber-bg)',
            color: 'var(--amber)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Robot sedang tersambung lewat USB. Putuskan dulu supaya port bisa dipakai untuk flashing.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                void disconnect();
                showToast('Robot diputus — sekarang bisa flash firmware.', 'info');
              }}
              style={{
                border: 'none',
                borderRadius: 'var(--r-full)',
                padding: '7px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                background: 'var(--amber)',
                color: '#fff',
              }}
            >
              Putuskan koneksi
            </button>
          </div>
        </div>
      )}

      {/* Three firmware types, each with a feature table */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FIRMWARES.map((fw) => (
          <FirmwareCard key={fw.ver} fw={fw} supported={supported} loaded={loaded} serialBusy={serialBusy} />
        ))}
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-400)', lineHeight: 1.5 }}>
        Colok robot ke komputer pakai USB, klik Flash, lalu pilih port (ESP32: <code>USB-SERIAL CH340</code>;
        S3: <code>USB JTAG/serial</code>). Jangan cabut kabel saat proses flashing.
      </p>
    </div>
  );
}


function FeatureTable({ feats }: { feats: (boolean | string)[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, margin: '2px 0 10px' }}>
      <tbody>
        {FEATURES.map((label, i) => {
          const v = feats[i];
          const cell = v === true ? '✅' : v === false ? '❌' : String(v);
          return (
            <tr key={label} style={{ borderTop: '1px solid var(--line-soft)' }}>
              <td style={{ padding: '4px 0', color: 'var(--ink-500)' }}>{label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700 }}>{cell}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FirmwareCard({ fw, supported, loaded, serialBusy }: {
  fw: Firmware; supported: boolean; loaded: boolean; serialBusy: boolean;
}) {
  const bin = `${BASE}/firmware/robotku-${fw.ver}.bin`;
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: `1px solid ${fw.color}55`, background: `${fw.color}11` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: fw.color }}>{fw.title}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{fw.ver} · {fw.chip}</span>
      </div>
      <div style={{ fontSize: 11.5, margin: '2px 0 4px', color: 'var(--ink-500)' }}>{fw.status}</div>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.5 }}>{fw.desc}</p>
      <FeatureTable feats={fw.feats} />
      {fw.setup && (
        <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--ink-500)' }}>
          Setelah flash: <code>{fw.setup}</code>
        </p>
      )}
      {supported && loaded ? (
        createElement('esp-web-install-button', { manifest: BASE + fw.manifest },
          createElement('button', {
            slot: 'activate', disabled: serialBusy,
            style: { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 'var(--r-full)',
              padding: '10px 18px', fontWeight: 800, fontSize: 14, cursor: serialBusy ? 'not-allowed' : 'pointer',
              opacity: serialBusy ? 0.5 : 1, background: fw.color, color: '#fff', fontFamily: 'inherit' },
          }, `⟳ Flash ${fw.title} via USB`),
        )
      ) : !supported ? (
        <a href={bin} download style={{ color: fw.color, fontWeight: 700 }}>⬇ Download {fw.ver} .bin</a>
      ) : null}
    </div>
  );
}