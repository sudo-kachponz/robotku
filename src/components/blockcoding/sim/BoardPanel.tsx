// src/components/blockcoding/sim/BoardPanel.tsx
//
// The "Papan" section for the Block Coding simulator (4.md): draws the real board
// + plugged-in OLED/servo modules, reacting to EXISTING SimSink state (LED color,
// buzzer, port values, display text). Adds a "Pasang modul" attach panel (saved to
// localforage) and a "Coba langsung" manual panel — both simulator-only.

import { useEffect, useMemo, useRef, useState } from 'react';
import BoardSvg, { type PortVisual } from './BoardSvg';
import OledModule from './OledModule';
import ServoModule from './ServoModule';
import PixelEditor, { type Bitmap } from './PixelEditor';
import OledAnimator from './OledAnimator';
import { useDrive } from '../../../hooks/useDrive';
import { PWM_PORTS, I2C_PORTS } from '../../../domain/hardware';
import { loadSimModules, persistSimModules, type SimModules } from '../../../app/persistence';
import type { SimState } from '../../../runtime/SimSink';

function parseRgb(s: string | null): { r: number; g: number; b: number } | null {
  if (!s) return null;
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

// --- Web Audio: real in-browser sound, no OS TTS/voice deps. AudioContext is
// created lazily on the first click (browsers require a user gesture). ---
let audioCtx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  audioCtx ??= new AC();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}
function beep(freq: number, ms: number, when = 0): void {
  const ctx = ac();
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + ms / 1000 + 0.02);
}
// Speak via the OS voice if one exists; otherwise a retro beep-per-character so
// there's always audible feedback (the "TTS lewat buzzer" fallback).
function speak(text: string): void {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (synth && synth.getVoices().length > 0) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    synth.cancel();
    synth.speak(u);
    return;
  }
  [...text].slice(0, 28).forEach((ch, i) => {
    if (ch.trim()) beep(480 + (ch.charCodeAt(0) % 12) * 45, 70, i * 0.09);
  });
}

const box: React.CSSProperties = {
  background: '#fafafe',
  border: '1px solid #e7e9f2',
  borderRadius: 12,
  padding: 12,
};

export default function BoardPanel({ state }: { state: SimState }) {
  const { sendCommand } = useDrive();
  const [modules, setModules] = useState<SimModules>({});
  const [pending, setPending] = useState<'servo' | 'oled' | null>(null);
  const [showWires, setShowWires] = useState(true);
  const [manualRgb, setManualRgb] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<Bitmap | null>(null);
  const [buzzPulse, setBuzzPulse] = useState(false);
  const buzzTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadSimModules().then(setModules);
  }, []);

  const attach = (id: string) => {
    const kind = id[0] === 'P' ? 'pwm' : 'i2c';
    setModules((prev) => {
      const next = { ...prev };
      if (pending) {
        // servo only on PWM, OLED only on I2C
        if ((pending === 'servo') === (kind === 'pwm')) next[id] = pending;
      } else if (next[id]) {
        delete next[id]; // click again with nothing pending -> unplug
      }
      persistSimModules(next);
      return next;
    });
    setPending(null);
  };

  const rgb = manualRgb ? hexToRgb(manualRgb) : parseRgb(state.ledColor);
  const buzzerActive = buzzPulse || state.buzzerHz > 0;
  const oledText = manualText ?? state.displayText;
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

  const plugged = Object.entries(modules);
  const servoPortEntry = plugged.find(([_, kind]) => kind === 'servo');
  const servoPortId = servoPortEntry?.[0];
  const servoIdx = servoPortId ? PWM_PORTS.findIndex((p) => p.id === servoPortId) : -1;
  const servoSpeed = servoIdx >= 0 ? (state.portValues[servoIdx] ?? 0) : 0;

  const pressBuzz = () => {
    beep(880, 220); // real sound
    setBuzzPulse(true); // + the visual wave on the board
    if (buzzTimer.current) clearTimeout(buzzTimer.current);
    buzzTimer.current = setTimeout(() => setBuzzPulse(false), 900);
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
          <span style={{ fontSize: 11, color: '#6b7194' }}>Klik port untuk pasang / cabut modul</span>
        </div>

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
        />
      </div>

      {/* ── Kamus Pinout & Jalur Kabel (Skema Edukasi Anak) ── */}
      <div
        style={{
          ...box,
          background: '#ffffff',
          padding: '12px 14px',
          boxShadow: '0 1px 3px rgba(27,24,64,0.04)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1b1840', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📚</span>
          <span>Kamus Jalur Kabel & Pinout (Biar Anak Paham Port):</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {/* I2C Column */}
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 6, borderBottom: '1px solid #cbd5e1', paddingBottom: 3 }}>
              🟦 Port I2C (I1 - I5) ➔ Layar OLED 0.96&quot;
            </div>
            <div style={{ display: 'grid', gap: 5, fontSize: 11, color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                <span><strong>GND</strong> (Biru/Hitam): Ground / 0V (Kutub Negatif)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
                <span><strong>VCC/VDD</strong> (Hijau/Merah): Daya Listrik Positif (3.3V)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#EAB308', flexShrink: 0 }} />
                <span><strong>SCL/SCK</strong> (Kuning): Clock Pengatur Tempo I2C</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#EA580C', flexShrink: 0 }} />
                <span><strong>SDA</strong> (Oranye): Jalur Data Teks & Gambar</span>
              </div>
            </div>
          </div>

          {/* PWM Column */}
          <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 6, borderBottom: '1px solid #cbd5e1', paddingBottom: 3 }}>
              🟧 Port PWM (P1 - P5) ➔ Motor Servo SG90
            </div>
            <div style={{ display: 'grid', gap: 5, fontSize: 11, color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                <span><strong>PWM</strong> (Kuning/Oranye): Sinyal Pulsa Sudut Putaran</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
                <span><strong>5V</strong> (Merah): Sumber Listrik Positif 5 Volt</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#78350F', flexShrink: 0 }} />
                <span><strong>GND</strong> (Cokelat/Hitam): Ground / Kutub Negatif</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail zoom modul jika terpasang */}
      {plugged.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {plugged.map(([id, kind]) => (
            <div key={id} style={{ ...box, padding: 10, background: '#ffffff', boxShadow: '0 1px 3px rgba(27,24,64,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1b1840' }}>
                  {kind === 'oled' ? '📺 Layar OLED 0.96"' : '⚙️ Servo SG90'} ({id})
                </span>
                <button
                  onClick={() => attach(id)}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    cursor: 'pointer',
                  }}
                  title="Cabut modul ini"
                >
                  Cabut
                </button>
              </div>
              {kind === 'oled' ? (
                <OledModule
                  text={oledText}
                  shape={state.lcdShape}
                  matrix={matrixOn ? state.matrix.map(Boolean) : undefined}
                  bitmap={bitmap}
                />
              ) : (
                <ServoModule speed={state.portValues[PWM_PORTS.findIndex((p) => p.id === id)] ?? 0} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Coba langsung (simulator only) ── */}
      <div style={{ ...box, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#ffffff' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1b1840' }}>
          Coba langsung <em style={{ color: '#6b7194', fontWeight: 400 }}>(hanya simulator)</em>:
        </span>
        <input
          type="text"
          placeholder="Teks OLED…"
          aria-label="Teks OLED simulator"
          onChange={(e) => setManualText(e.target.value || null)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #c6caff', background: '#ffffff', color: '#1b1840' }}
        />
        <button onClick={pressBuzz} style={btn(false)}>
          Bunyi buzzer
        </button>
        <button onClick={() => speak(manualText || 'Hello')} style={btn(false)}>
          🔊 Bicara
        </button>
      </div>

      {/* ── Warna LED — real hex color wheel ── */}
      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#ffffff' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1b1840' }}>Warna LED (RGB):</span>
        <input
          type="color"
          defaultValue="#ff0000"
          aria-label="Pilih warna LED (roda warna, hex)"
          onChange={(e) => {
            const hex = e.target.value;
            setManualRgb(hex);
            const { r, g, b } = hexToRgb(hex);
            sendCommand('SET_LED_COLOR', { r, g, b });
          }}
          style={{ width: 48, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12, color: '#6b7194', fontFamily: 'monospace' }}>{manualRgb ?? '#ff0000'}</span>
        <em style={{ fontSize: 11, color: '#6b7194' }}>roda warna + hex, langsung ke LED asli</em>
      </div>

      {/* ── Gambar pixel -> OLED ── */}
      <div style={{ ...box, display: 'grid', gap: 8, background: '#ffffff' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1b1840' }}>
          Gambar pixel (OLED) <em style={{ color: '#6b7194', fontWeight: 400 }}>— gambar, lalu Kirim ke OLED</em>
        </span>
        <PixelEditor onSend={setBitmap} onPreview={setBitmap} />
      </div>

      {/* ── Wokwi-style OLED animator ── */}
      <div style={{ ...box, display: 'grid', gap: 8, background: '#ffffff' }}>
        <OledAnimator onFrame={setBitmap} />
      </div>
    </div>
  );
}

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
