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

const LATEST_FW = '2.4.0-mk';
const MANIFEST = '/firmware/manifest.json';
const BIN_URL = `/firmware/robotku-${LATEST_FW}.bin`;

// ponytail: OTA_UPDATE removed in 2.4.0-mk firmware. OTA section disabled
// until capability check is wired (see Fajri's relay notes).

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

  const otaVersion = manifest?.version ?? LATEST_FW;

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

      <div style={{ marginTop: 16 }}>
        {supported ? (
          loaded ? (
            createElement(
              'esp-web-install-button',
              { manifest: MANIFEST },
              createElement(
                'button',
                {
                  slot: 'activate',
                  disabled: serialBusy,
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    border: 'none',
                    borderRadius: 'var(--r-full)',
                    padding: '12px 22px',
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: serialBusy ? 'not-allowed' : 'pointer',
                    opacity: serialBusy ? 0.5 : 1,
                    background: 'var(--indigo-600)',
                    color: '#fff',
                    fontFamily: 'inherit',
                  },
                },
                '⟳ Update Firmware via USB',
              ),
            )
          ) : (
            <span style={{ color: 'var(--ink-400)', fontSize: 14 }}>Menyiapkan pembaru…</span>
          )
        ) : (
          <div style={{ fontSize: 14, color: 'var(--ink-600)', lineHeight: 1.6 }}>
            Browser ini tidak mendukung Web Serial (pakai Chrome/Edge di desktop).
            <br />
            <a href={BIN_URL} download style={{ color: 'var(--indigo-600)', fontWeight: 700 }}>
              ⬇ Download firmware .bin
            </a>{' '}
            lalu flash dengan esptool:{' '}
            <code style={{ fontSize: 12 }}>esptool write-flash 0x0 robotku-{LATEST_FW}.bin</code>
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-400)', lineHeight: 1.5 }}>
        Colok robot ke komputer pakai kabel USB, klik tombol di atas, lalu pilih port
        <code> USB-SERIAL CH340</code> di jendela yang muncul. Jangan cabut kabel saat proses flashing.
      </p>
    </div>
  );
}
