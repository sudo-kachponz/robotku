// src/components/blockcoding/sim/BoardPanel.tsx
//
// The "Papan" section for the Block Coding simulator (4.md): draws the real board
// + plugged-in OLED/servo modules, reacting to EXISTING SimSink state (LED color,
// buzzer, port values, display text). Adds a "Pasang modul" attach panel (saved to
// localforage) and a rich interactive RGB LED Color Control with Block insertion.

import { useEffect, useMemo, useState } from 'react';
import BoardSvg, { type PortVisual } from './BoardSvg';
import OledModule, { type Bitmap } from './OledModule';
import ServoModule from './ServoModule';
import { useDrive } from '../../../hooks/useDrive';
import { PWM_PORTS, I2C_PORTS } from '../../../domain/hardware';
import { loadSimModules, persistSimModules, type SimModules } from '../../../app/persistence';
import type { SimState } from '../../../runtime/SimSink';
import { insertLcdBlock } from '../../../templates/galleryBridge';

function parseRgb(s: string | null): { r: number; g: number; b: number } | null {
  if (!s) return null;
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex || hex.length < 7) return { r: 255, g: 0, b: 0 };
  return {
    r: parseInt(hex.slice(1, 3), 16) || 0,
    g: parseInt(hex.slice(3, 5), 16) || 0,
    b: parseInt(hex.slice(5, 7), 16) || 0,
  };
}
// The RGB LED is DIGITAL — each channel is fully on/off at the firmware's >127
// threshold (PWM would starve the servo LEDC timers). Snap the preview so the sim
// LED shows the ACTUAL color the hardware lights, not the raw hex the picker allows.
function snap8(c: { r: number; g: number; b: number } | null): { r: number; g: number; b: number } | null {
  if (!c) return null;
  return { r: c.r > 127 ? 255 : 0, g: c.g > 127 ? 255 : 0, b: c.b > 127 ? 255 : 0 };
}

export interface LedColorOption {
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
}

export const LED_PALETTE: LedColorOption[] = [
  // Baris 1 (10 warna)
  { name: 'Hitam (Off)', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } },
  { name: 'Abu-abu', hex: '#6B7280', rgb: { r: 107, g: 114, b: 128 } },
  { name: 'Merah Tua', hex: '#881337', rgb: { r: 136, g: 19, b: 55 } },
  { name: 'Merah', hex: '#EF4444', rgb: { r: 255, g: 0, b: 0 } },
  { name: 'Oranye', hex: '#F97316', rgb: { r: 255, g: 127, b: 0 } },
  { name: 'Kuning', hex: '#FACC15', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'Hijau', hex: '#22C55E', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Biru Langit', hex: '#0EA5E9', rgb: { r: 0, g: 255, b: 255 } },
  { name: 'Biru', hex: '#3B82F6', rgb: { r: 0, g: 0, b: 255 } },
  { name: 'Ungu', hex: '#8B5CF6', rgb: { r: 128, g: 0, b: 128 } },

  // Baris 2 (10 warna)
  { name: 'Putih', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'Abu Terang', hex: '#D1D5DB', rgb: { r: 195, g: 195, b: 195 } },
  { name: 'Cokelat', hex: '#92400E', rgb: { r: 185, g: 122, b: 87 } },
  { name: 'Pink', hex: '#F472B6', rgb: { r: 255, g: 0, b: 255 } },
  { name: 'Emas', hex: '#EAB308', rgb: { r: 255, g: 201, b: 14 } },
  { name: 'Kuning Pasir', hex: '#FEF08A', rgb: { r: 239, g: 228, b: 176 } },
  { name: 'Hijau Muda / Lime', hex: '#84CC16', rgb: { r: 181, g: 230, b: 29 } },
  { name: 'Biru Muda', hex: '#7DD3FC', rgb: { r: 153, g: 217, b: 234 } },
  { name: 'Abu Kebiruan', hex: '#64748B', rgb: { r: 112, g: 146, b: 190 } },
  { name: 'Lavender', hex: '#C4B5FD', rgb: { r: 200, g: 191, b: 231 } },
];

const box: React.CSSProperties = {
  background: '#fafafe',
  border: '1px solid #e7e9f2',
  borderRadius: 12,
  padding: 10,
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
};

export default function BoardPanel({ state }: { state: SimState }) {
  const { sendCommand } = useDrive();
  const [modules, setModules] = useState<SimModules>({});
  const [pending, setPending] = useState<'servo' | 'oled' | null>(null);
  const [showWires, setShowWires] = useState(true);
  const [selectedHex, setSelectedHex] = useState<string>('#ef4444');
  const [selectedName, setSelectedName] = useState<string>('Merah');
  const [duration, setDuration] = useState<number>(1);
  const [manualRgb, setManualRgb] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<Bitmap | null>(null);
  const [showPinHint, setShowPinHint] = useState(false);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    loadSimModules().then(setModules);
  }, []);

  const handleResetPositions = () => {
    setPositions({});
  };

  const attach = (id: string) => {
    const kind = id[0] === 'P' ? 'pwm' : 'i2c';
    setModules((prev) => {
      const next = { ...prev };
      if (pending) {
        // servo only on PWM, OLED only on I2C
        if ((pending === 'servo') === (kind === 'pwm')) next[id] = pending;
      } else if (next[id]) {
        delete next[id]; // click again with nothing pending -> unplug
      } else {
        // 1-click auto plug when clicking directly on port
        next[id] = kind === 'pwm' ? 'servo' : 'oled';
      }
      persistSimModules(next);
      return next;
    });
    setPending(null);
  };

  const [showSliders, setShowSliders] = useState(false);
  const rgb = snap8(manualRgb ? hexToRgb(manualRgb) : parseRgb(state.ledColor));
  const currentRgb = hexToRgb(selectedHex);
  const buzzerActive = state.buzzerHz > 0;
  const oledText = state.displayText;
  const matrixOn = state.matrix.some((v) => v);

  const ports: PortVisual[] = useMemo(() => {
    const pwm = PWM_PORTS.map((p, i) => ({
      id: p.id,
      kind: 'pwm' as const,
      active: state.portValues[i] !== 0,
      module: (modules[p.id] as 'servo' | undefined) ?? null,
    }));
    const i2c = I2C_PORTS.map((p) => ({
      id: p.id,
      kind: 'i2c' as const,
      module: (modules[p.id] as 'oled' | undefined) ?? null,
    }));
    return [...pwm, ...i2c];
  }, [modules, state.portValues]);

  const servoSpeedsMap = useMemo(() => {
    const map: Record<string, number> = {};
    PWM_PORTS.forEach((p, idx) => {
      map[p.id] = state.portValues[idx] ?? 0;
    });
    return map;
  }, [state.portValues]);

  const plugged = Object.entries(modules);
  const servoPortEntry = plugged.find(([_, kind]) => kind === 'servo');
  const servoPortId = servoPortEntry?.[0];
  const servoIdx = servoPortId ? PWM_PORTS.findIndex((p) => p.id === servoPortId) : -1;
  const servoSpeed = servoIdx >= 0 ? (state.portValues[servoIdx] ?? 0) : 0;

  const handleSelectColor = (hex: string, name?: string) => {
    setSelectedHex(hex);
    setSelectedName(name || `Kustom ${hex.toUpperCase()}`);
    setManualRgb(hex);
    const { r, g, b } = hexToRgb(hex);
    sendCommand('SET_LED_COLOR', { r, g, b });
  };

  const handleRgbSlider = (channel: 'r' | 'g' | 'b', val: number) => {
    const cur = hexToRgb(selectedHex);
    const updated = { ...cur, [channel]: Math.max(0, Math.min(255, val)) };
    const hex = `#${updated.r.toString(16).padStart(2, '0')}${updated.g.toString(16).padStart(2, '0')}${updated.b.toString(16).padStart(2, '0')}`;
    setSelectedHex(hex);
    setSelectedName(`Kustom ${hex.toUpperCase()}`);
    setManualRgb(hex);
    sendCommand('SET_LED_COLOR', updated);
  };

  const handleHexInput = (val: string) => {
    setSelectedHex(val);
    const clean = val.trim();
    if (/^#?[0-9A-Fa-f]{6}$/.test(clean)) {
      const hex = clean.startsWith('#') ? clean : `#${clean}`;
      setSelectedName(`Kustom ${hex.toUpperCase()}`);
      setManualRgb(hex);
      const { r, g, b } = hexToRgb(hex);
      sendCommand('SET_LED_COLOR', { r, g, b });
    }
  };

  const handleInsertBlock = () => {
    const dur = duration > 0 ? duration : 1;
    insertLcdBlock(
      [
        {
          type: 'set_led_color',
          fields: { COLOR: selectedHex },
          inputs: { DURATION: dur },
        },
      ],
      `🧩 Blok LED (${selectedName || selectedHex}, ${dur}s) dipasang!`
    );
  };

  const handleSendDirect = () => {
    const { r, g, b } = hexToRgb(selectedHex);
    setManualRgb(selectedHex);
    sendCommand('SET_LED_COLOR', { r, g, b });
  };

  const handleTurnOff = () => {
    setSelectedHex('#000000');
    setSelectedName('Hitam (Off)');
    setManualRgb('#000000');
    sendCommand('SET_LED_COLOR', { r: 0, g: 0, b: 0 });
  };

  return (
    <div style={{ ...box, display: 'grid', gap: 14 }} aria-label="Papan simulator Robotku">
      {/* ── Toolbar Pasang Modul & Kabel ── */}
      <div
        style={{
          ...box,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(27,24,64,0.04)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1b1840' }}>🔌 Pasang Modul:</span>
        <button
          onClick={() => setPending(pending === 'servo' ? null : 'servo')}
          aria-pressed={pending === 'servo'}
          style={btn(pending === 'servo')}
        >
          {pending === 'servo' ? '👉 Pilih Port P1-P5...' : '+ Servo SG90'}
        </button>
        <button
          onClick={() => setPending(pending === 'oled' ? null : 'oled')}
          aria-pressed={pending === 'oled'}
          style={btn(pending === 'oled')}
        >
          {pending === 'oled' ? '👉 Pilih Port I1-I5...' : '+ Layar OLED'}
        </button>

        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#403c6b',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showWires}
            onChange={(e) => setShowWires(e.target.checked)}
            aria-label="Tampilkan kabel schematics"
            style={{ cursor: 'pointer' }}
          />
          ⚡ Tampilkan Kabel Skematik
        </label>
      </div>

      {pending && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            color: '#92400e',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>💡</span>
          <span>
            Klik pin header <strong>{pending === 'servo' ? 'PWM (Bawah: P1 - P5)' : 'I2C (Atas: I1 - I5)'}</strong> di
            papan untuk menancapkan kabel {pending === 'servo' ? 'Servo SG90' : 'Layar OLED SSD1306'}.
          </span>
        </div>
      )}

      {/* ── Interactive Fritzing Schematic Board Canvas ── */}
      <div
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
          border: '1px solid #dbe1f5',
          borderRadius: 14,
          padding: 12,
          boxShadow: '0 2px 8px rgba(27,24,64,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            borderBottom: '1px solid #edf0fa',
            paddingBottom: 6,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1b1840' }}>📐 Skema Rangkaian Interaktif</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: '#eef0ff',
                color: '#4338ca',
              }}
            >
              Fritzing Live View
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleResetPositions}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
              title="Kembalikan tata letak semua modul dan papan ke posisi awal"
            >
              <span>↺</span>
              <span>Reset Posisi</span>
            </button>

            <button
              onClick={() => setShowPinHint((prev) => !prev)}
              aria-expanded={showPinHint}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 6,
                border: `1px solid ${showPinHint ? '#6366e8' : '#cbd5e1'}`,
                background: showPinHint ? '#eef0ff' : '#ffffff',
                color: showPinHint ? '#4338ca' : '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
              title="Klik untuk melihat arti warna kabel & fungsi pin"
            >
              <span>📚</span>
              <span>{showPinHint ? 'Tutup Kamus Pin' : 'Kamus Pinout'}</span>
            </button>
            <span style={{ fontSize: 11, color: '#6b7194' }}>💡 Klik port untuk pasang/cabut | ✋ Drag untuk geser modul bebas</span>
          </div>
        </div>

        {/* ── Modal / Collapsible Hint Panel ── */}
        {showPinHint && (
          <div
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>
                📚 Kamus Jalur Kabel & Pinout (Biar Anak Paham Port):
              </span>
              <button
                onClick={() => setShowPinHint(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 14,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0 4px',
                  fontWeight: 700,
                }}
                title="Tutup"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {/* I2C Column */}
              <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', marginBottom: 4 }}>
                  🟦 Port I2C (I1 - I5) ➔ Layar OLED 0.96&quot;
                </div>
                <div style={{ display: 'grid', gap: 3.5, fontSize: 10.5, color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                    <span><strong>GND</strong> (Biru/Hitam): Ground / 0V (Kutub Negatif)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                    <span><strong>VCC/VDD</strong> (Hijau/Merah): Daya Listrik Positif (3.3V)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EAB308', flexShrink: 0 }} />
                    <span><strong>SCL/SCK</strong> (Kuning): Clock Pengatur Tempo I2C</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#EA580C', flexShrink: 0 }} />
                    <span><strong>SDA</strong> (Oranye): Jalur Data Teks & Gambar</span>
                  </div>
                </div>
              </div>

              {/* PWM Column */}
              <div style={{ background: '#ffffff', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', marginBottom: 4 }}>
                  🟧 Port PWM (P1 - P5) ➔ Motor Servo SG90
                </div>
                <div style={{ display: 'grid', gap: 3.5, fontSize: 10.5, color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                    <span><strong>PWM</strong> (Kuning/Oranye): Sinyal Pulsa Sudut Putaran</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
                    <span><strong>5V</strong> (Merah): Sumber Listrik Positif 5 Volt</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#78350F', flexShrink: 0 }} />
                    <span><strong>GND</strong> (Cokelat/Hitam): Ground / Kutub Negatif</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <BoardSvg
          rgb={rgb}
          buzzerActive={buzzerActive}
          linkState="off"
          ports={ports}
          onPortClick={attach}
          showWires={showWires}
          oledText={oledText ?? undefined}
          oledShape={state.lcdShape}
          oledMatrix={matrixOn ? state.matrix.map(Boolean) : undefined}
          oledBitmap={bitmap}
          servoSpeed={servoSpeed}
          servoSpeeds={servoSpeedsMap}
          positions={positions}
          onPositionsChange={setPositions}
        />
      </div>

      {/* OLED module = the ONE unified live interactive screen with realistic mint frame, direct pixel drawing, templates, animations, and live schematic sync */}
      {plugged.filter(([, k]) => k === 'oled').map(([id]) => (
        <div key={id} style={{ ...box, padding: 12, background: '#ffffff', boxShadow: '0 1px 3px rgba(27,24,64,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1b1840' }}>📺 Layar OLED 0.96&quot; ({id})</span>
            <button onClick={() => attach(id)} style={cabutBtn} title="Cabut modul ini">
              Cabut
            </button>
          </div>
          <OledModule
            text={oledText}
            shape={state.lcdShape}
            matrix={matrixOn ? state.matrix.map(Boolean) : undefined}
            bitmap={bitmap}
            onBitmapChange={setBitmap}
          />
        </div>
      ))}

      {/* Servo modules */}
      {plugged.some(([, k]) => k === 'servo') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {plugged.filter(([, k]) => k === 'servo').map(([id]) => (
            <div key={id} style={{ ...box, padding: 10, background: '#ffffff', boxShadow: '0 1px 3px rgba(27,24,64,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1b1840' }}>⚙️ Servo SG90 ({id})</span>
                <button onClick={() => attach(id)} style={cabutBtn} title="Cabut modul ini">
                  Cabut
                </button>
              </div>
              <ServoModule speed={state.portValues[PWM_PORTS.findIndex((p) => p.id === id)] ?? 0} />
            </div>
          ))}
        </div>
      )}

      {/* No OLED attached: point the user to attach one to draw/animate. */}
      {!plugged.some(([, k]) => k === 'oled') && (
        <div style={{ ...box, background: '#ffffff', fontSize: 12, color: '#6b7194' }}>
          🖼️ Pasang <strong>Layar OLED</strong> (port I1–I5) untuk menggambar pixel & memainkan animasi di layarnya.
        </div>
      )}

      {/* ── Kontrol LED RGB & Generator Blok LED ── */}
      <div
        style={{
          ...box,
          background: '#ffffff',
          boxShadow: '0 2px 8px rgba(27,24,64,0.04)',
          border: '1px solid #e7e9f2',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Header with Title & Current Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1b1840' }}>
                Kontrol Warna LED (RGB)
              </div>
              <div style={{ fontSize: 11, color: '#6b7194' }}>
                Pilih warna palet, roda warna, atau sesuaikan slider RGB untuk membuat blok kode
              </div>
              <div style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>
                ⚠️ LED asli digital (8 warna) — warna dibulatkan ke merah/hijau/biru terdekat. Preview LED papan sudah menunjukkan warna asli yang menyala.
              </div>
            </div>
          </div>

          {/* Quick status pill with editable HEX input */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: '2px 8px 2px 6px',
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: selectedHex === '#000000' ? '#94a3b8' : selectedHex,
                boxShadow: selectedHex === '#000000' ? 'none' : `0 0 8px ${selectedHex}`,
                border: '1px solid rgba(0,0,0,0.1)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={selectedHex.toUpperCase()}
              onChange={(e) => handleHexInput(e.target.value)}
              title="Ketik kode HEX langsung (misal: #FF0055)"
              style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                fontSize: 11,
                width: 68,
                border: 'none',
                background: 'transparent',
                color: '#1e293b',
                padding: '2px 4px',
                textAlign: 'center',
                borderRadius: 4,
              }}
            />
            <span style={{ color: '#64748b', fontSize: 10 }}>({currentRgb.r}, {currentRgb.g}, {currentRgb.b})</span>
          </div>
        </div>

        {/* Palette & Color Wheel Container (matching benchmark screenshot) */}
        <div
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* 2-row x 10-column Swatches Grid */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {/* Row 1 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {LED_PALETTE.slice(0, 10).map((col) => {
                const isSelected = selectedHex.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => handleSelectColor(col.hex, col.name)}
                    title={`${col.name} (${col.hex})`}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: col.hex,
                      border: col.hex.toLowerCase() === '#ffffff' ? '1.5px solid #cbd5e1' : isSelected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
                      boxShadow: isSelected ? `0 0 0 2px #ffffff, 0 0 0 4px #3b82f6, 0 2px 5px ${col.hex}66` : '0 1px 2px rgba(0,0,0,0.1)',
                      transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>

            {/* Row 2 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {LED_PALETTE.slice(10, 20).map((col) => {
                const isSelected = selectedHex.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => handleSelectColor(col.hex, col.name)}
                    title={`${col.name} (${col.hex})`}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: col.hex,
                      border: col.hex.toLowerCase() === '#ffffff' ? '1.5px solid #cbd5e1' : isSelected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
                      boxShadow: isSelected ? `0 0 0 2px #ffffff, 0 0 0 4px #3b82f6, 0 2px 5px ${col.hex}66` : '0 1px 2px rgba(0,0,0,0.1)',
                      transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Color Wheel Picker Trigger on the Right with Safe Containment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <label
              title="Buka Roda Warna / Pilih Warna Bebas"
              style={{
                position: 'relative',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                border: '2px solid #ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: '1.5px solid #ffffff',
                  boxShadow: '0 0 2px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="color"
                value={selectedHex.startsWith('#') && selectedHex.length === 7 ? selectedHex : '#EF4444'}
                onChange={(e) => handleSelectColor(e.target.value, `Kustom ${e.target.value.toUpperCase()}`)}
                aria-label="Pilih warna LED kustom"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                }}
              />
            </label>

            {/* Slider Toggle Button */}
            <button
              type="button"
              onClick={() => setShowSliders(!showSliders)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: showSliders ? '#e0e7ff' : '#ffffff',
                color: showSliders ? '#3730a3' : '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Buka penggeser Red, Green, Blue di halaman"
            >
              <span>🎨 Slider RGB</span>
            </button>
          </div>
        </div>

        {/* Collapsible In-Page RGB Slider Controls (Never overflows browser) */}
        {showSliders && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            {/* Red Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', width: 28 }}>R:</span>
              <input
                type="range"
                min="0"
                max="255"
                value={currentRgb.r}
                onChange={(e) => handleRgbSlider('r', parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: '#dc2626', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, width: 26, textAlign: 'right' }}>
                {currentRgb.r}
              </span>
            </div>

            {/* Green Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', width: 28 }}>G:</span>
              <input
                type="range"
                min="0"
                max="255"
                value={currentRgb.g}
                onChange={(e) => handleRgbSlider('g', parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: '#16a34a', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, width: 26, textAlign: 'right' }}>
                {currentRgb.g}
              </span>
            </div>

            {/* Blue Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', width: 28 }}>B:</span>
              <input
                type="range"
                min="0"
                max="255"
                value={currentRgb.b}
                onChange={(e) => handleRgbSlider('b', parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, width: 26, textAlign: 'right' }}>
                {currentRgb.b}
              </span>
            </div>
          </div>
        )}

        {/* Action Controls Toolbar: Duration, Insert Block, Direct Test, Turn Off */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            paddingTop: 4,
          }}
        >
          {/* Duration Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', fontWeight: 600 }}>
            <span>⏱️ Durasi:</span>
            <input
              type="number"
              min="0.1"
              max="60"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(Math.max(0.1, parseFloat(e.target.value) || 1))}
              style={{
                width: 54,
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
                color: '#1e293b',
                background: '#ffffff',
              }}
            />
            <span style={{ color: '#64748b', fontSize: 11 }}>detik</span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Insert as BLOCK LED */}
            <button
              type="button"
              onClick={handleInsertBlock}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.15s ease',
              }}
              title="Pasang blok kode Set LED Color ke lembar kerja Blockly"
            >
              <span>🧩 Pasang Blok LED</span>
            </button>

            {/* Test directly on Robot & Simulator */}
            <button
              type="button"
              onClick={handleSendDirect}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                color: '#4338ca',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Kirim perintah langsung ke simulator dan LED robot fisik"
            >
              <span>🚀 Tes Nyala</span>
            </button>

            {/* Turn Off LED */}
            <button
              type="button"
              onClick={handleTurnOff}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Matikan LED (Off / Hitam)"
            >
              <span>Matikan</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

const cabutBtn: React.CSSProperties = {
  fontSize: 10,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#b91c1c',
  cursor: 'pointer',
};

function btn(active: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: 8,
    border: `1px solid ${active ? '#6366e8' : '#e0e3ff'}`,
    background: active ? '#eef0ff' : '#ffffff',
    color: active ? '#4338ca' : '#403c6b',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(27,24,64,0.05)',
  };
}
