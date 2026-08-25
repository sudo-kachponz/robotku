// src/pages/control/settings.tsx
//
// Settings — tabs [Settings | Guide]. Edits the shared RobotSettings.
// Guide: Illustrated steps adhering strictly to Robotku Design System tokens (Pink accents & badges).

import { useState } from 'react';
import ControlLayout from '../../components/control/ControlLayout';
import { useSettings } from '../../hooks/useDrive';
import { setSettings, resetSettings } from '../../app/settingsStore';
import { cloneSettings, type RobotSettings, type Speed } from '../../domain/settings';
import { showToast } from '../../ui/toast';
import guide1Svg from '../../assets/Guide1.svg';
import guide2Svg from '../../assets/Guide2.svg';
import guide3Svg from '../../assets/Guide3.svg';
import styles from '../../styles/Settings.module.css';

const COMMUNITY_URL = 'https://robotku.id/community';
const SPEEDS: Speed[] = ['Fast', 'Medium', 'Slow'];

export default function SettingsPage() {
  const [tab, setTab] = useState<'settings' | 'guide'>('settings');
  const settings = useSettings();

  const edit = (fn: (s: RobotSettings) => void) => {
    const next = cloneSettings(settings);
    fn(next);
    setSettings(next);
  };

  return (
    <ControlLayout title="Settings">
      <div className={styles.page}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
          <button
            className={`${styles.tab} ${tab === 'guide' ? styles.tabActive : ''}`}
            onClick={() => setTab('guide')}
          >
            Guide
          </button>
        </div>

        {tab === 'settings' ? (
          <SettingsTab settings={settings} edit={edit} />
        ) : (
          <GuideTab />
        )}
      </div>
    </ControlLayout>
  );
}

function SettingsTab({
  settings,
  edit,
}: {
  settings: RobotSettings;
  edit: (fn: (s: RobotSettings) => void) => void;
}) {
  return (
    <>
      {/* Port mapping */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Port Mapping</h2>
        <p className={styles.cardSub}>Pilih port (1–8) untuk tiap fungsi di setiap mode.</p>

        <MapGroup label="Base · Arms" ports={settings.mapping.base.arms}
          onToggle={(p) => edit((s) => toggle(s.mapping.base.arms, p))} />
        <MapGroup label="Base · Kiri" ports={settings.mapping.base.left}
          onToggle={(p) => edit((s) => toggle(s.mapping.base.left, p))} />
        <MapGroup label="Base · Kanan" ports={settings.mapping.base.right}
          onToggle={(p) => edit((s) => toggle(s.mapping.base.right, p))} />

        <MapGroup label="Tank · Turret" ports={settings.mapping.tank.turret}
          onToggle={(p) => edit((s) => toggle(s.mapping.tank.turret, p))} />
        <MapGroup label="Tank · Kiri" ports={settings.mapping.tank.left}
          onToggle={(p) => edit((s) => toggle(s.mapping.tank.left, p))} />
        <MapGroup label="Tank · Kanan" ports={settings.mapping.tank.right}
          onToggle={(p) => edit((s) => toggle(s.mapping.tank.right, p))} />

        <MapGroup label="Joystick · Kiri" ports={settings.mapping.joystick.left}
          onToggle={(p) => edit((s) => toggle(s.mapping.joystick.left, p))} />
        <MapGroup label="Joystick · Kanan" ports={settings.mapping.joystick.right}
          onToggle={(p) => edit((s) => toggle(s.mapping.joystick.right, p))} />
        <MapGroup label="Joystick · Custom Y" ports={settings.mapping.joystick.customY}
          onToggle={(p) => edit((s) => toggle(s.mapping.joystick.customY, p))} />
        <MapGroup label="Joystick · Custom X" ports={settings.mapping.joystick.customX}
          onToggle={(p) => edit((s) => toggle(s.mapping.joystick.customX, p))} />
      </div>

      {/* Speed & direction */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Speed and Direction</h2>
        <p className={styles.cardSub}>Atur kecepatan tiap port dan balik arah (DEFAULT).</p>
        <div className={styles.speedTable}>
          {Array.from({ length: 8 }, (_, i) => {
            const port = i + 1;
            const cfg = settings.ports[port];
            return (
              <div key={port} className={styles.speedRow}>
                <span className={styles.mapLabel}>Port {port}</span>
                <div className={styles.segGroup}>
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      className={`${styles.seg} ${cfg.speed === sp ? styles.segOn : ''}`}
                      onClick={() => edit((s) => { s.ports[port].speed = sp; })}
                    >
                      {sp}
                    </button>
                  ))}
                </div>
                <button
                  className={`${styles.invertBtn} ${cfg.invert ? styles.invertOn : ''}`}
                  onClick={() => edit((s) => { s.ports[port].invert = !s.ports[port].invert; })}
                >
                  {cfg.invert ? 'Inverted' : 'Default'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Keybinds */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Keybinds</h2>
        <p className={styles.cardSub}>Pintasan keyboard yang dipakai tiap mode.</p>
        <KeybindTable
          title="Base / Clawbot"
          rows={[
            ['Forward', ['W', '↑']], ['Backward', ['S', '↓']],
            ['Left', ['A', '←']], ['Right', ['D', '→']],
            ['Grab', ['Q']], ['Release', ['E']],
          ]}
        />
        <KeybindTable
          title="Port Control (SHIFT membalik)"
          rows={[['Port 1–8', ['1', '…', '8']]]}
        />
        <KeybindTable
          title="Tank"
          rows={[
            ['Left Throttle +/−', ['W', 'S']], ['Right Throttle +/−', ['E', 'D']],
            ['Turret CCW / CW', ['Q', 'R']],
          ]}
        />
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footMeta}>
          App Version: v1.0.0 · <a href={COMMUNITY_URL} target="_blank" rel="noreferrer">Report a bug</a>
        </span>
        <button
          className={styles.resetBtn}
          onClick={() => {
            resetSettings();
            showToast('Settings direset ke default.', 'info');
          }}
        >
          Reset to default
        </button>
      </div>
    </>
  );
}

function MapGroup({
  label,
  ports,
  onToggle,
}: {
  label: string;
  ports: number[];
  onToggle: (p: number) => void;
}) {
  return (
    <div className={styles.mapRow}>
      <span className={styles.mapLabel}>{label}</span>
      <div className={styles.chips}>
        {Array.from({ length: 8 }, (_, i) => {
          const p = i + 1;
          const on = ports.includes(p);
          return (
            <button
              key={p}
              className={`${styles.chip} ${on ? styles.chipOn : ''}`}
              onClick={() => onToggle(p)}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KeybindTable({ title, rows }: { title: string; rows: [string, string[]][] }) {
  return (
    <>
      <p className={styles.cardSub} style={{ marginTop: 14, marginBottom: 4, fontWeight: 700, color: 'var(--ink-700)' }}>
        {title}
      </p>
      <table className={styles.kbTable}>
        <tbody>
          {rows.map(([action, keys]) => (
            <tr key={action}>
              <td>{action}</td>
              <td className={styles.kbKeys}>
                {keys.map((k, i) => (
                  <span key={i} className={styles.kbd}>{k}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function GuideTab() {
  return (
    <div className={styles.guideContainer}>
      {/* Header Banner */}
      <div className={styles.guideBanner}>
        <span className={styles.guideBannerBadge}>PANDUAN PENGGUNAAN</span>
        <h2 className={styles.guideBannerTitle}>TUTORIAL PERANGKAT ROBOTKU</h2>
        <p className={styles.guideBannerSub}>
          Ikuti 3 langkah mudah di bawah ini untuk menghubungkan dan mengontrol robotmu!
        </p>
      </div>

      {/* Langkah 1 */}
      <div className={styles.guideCard}>
        <div className={styles.guideCardHeader}>
          <span className={styles.stepBadge}>LANGKAH 01</span>
          <h3 className={styles.guideTitle}>NYALAKAN PCB ROBOTKU</h3>
        </div>
        <p className={styles.guideDesc}>
          Colok kabel USB-C dari PCB Robotku ke power bank atau laptop hingga indikator daya menyala.
        </p>
        <div className={styles.imgWrap}>
          <img
            src={typeof guide1Svg === 'string' ? guide1Svg : guide1Svg.src}
            alt="1. Nyalakan PCB"
            className={styles.guideImg}
          />
        </div>
      </div>

      {/* Langkah 2 */}
      <div className={styles.guideCard}>
        <div className={styles.guideCardHeader}>
          <span className={styles.stepBadge}>LANGKAH 02</span>
          <h3 className={styles.guideTitle}>PASANG KABEL SERVO DENGAN BENAR</h3>
        </div>
        <p className={styles.guideDesc}>
          Perhatikan urutan dan warna kabel servo saat dipasang ke pin port:
        </p>
        <div className={styles.pinRow}>
          <div className={`${styles.pinChip} ${styles.pinYellow}`}>
            <span className={styles.pinDotYellow} />
            <span>Kabel Kuning → Pin S (Signal)</span>
          </div>
          <div className={`${styles.pinChip} ${styles.pinRed}`}>
            <span className={styles.pinDotRed} />
            <span>Kabel Merah → Pin V (VCC/Daya)</span>
          </div>
          <div className={`${styles.pinChip} ${styles.pinBrown}`}>
            <span className={styles.pinDotBrown} />
            <span>Kabel Cokelat → Pin G (Ground)</span>
          </div>
        </div>
        <div className={styles.imgWrap}>
          <img
            src={typeof guide2Svg === 'string' ? guide2Svg : guide2Svg.src}
            alt="2. Pasang Kabel Servo"
            className={styles.guideImg}
          />
        </div>
      </div>

      {/* Langkah 3 */}
      <div className={styles.guideCard}>
        <div className={styles.guideCardHeader}>
          <span className={styles.stepBadge}>LANGKAH 03</span>
          <h3 className={styles.guideTitle}>SAMBUNGKAN BLUETOOTH KE ROBOTKU</h3>
        </div>
        <p className={styles.guideDesc}>
          Klik tombol <strong>Connect</strong> di kanan bawah, lalu pilih robotmu. Saat Bluetooth terhubung, ikon akan berwarna hijau!
        </p>
        <div className={styles.imgWrap}>
          <img
            src={typeof guide3Svg === 'string' ? guide3Svg : guide3Svg.src}
            alt="3. Sambungkan ke Robotku"
            className={styles.guideImg}
          />
        </div>
      </div>
    </div>
  );
}

/* toggle a port in a group array in place */
function toggle(arr: number[], port: number): void {
  const i = arr.indexOf(port);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(port);
  arr.sort((a, b) => a - b);
}
