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

const box: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 12,
};

export default function BoardPanel({ state }: { state: SimState }) {
  const { sendCommand } = useDrive();
  const [modules, setModules] = useState<SimModules>({});
  const [pending, setPending] = useState<'servo' | 'oled' | null>(null);
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

  const pressBuzz = () => {
    setBuzzPulse(true);
    if (buzzTimer.current) clearTimeout(buzzTimer.current);
    buzzTimer.current = setTimeout(() => setBuzzPulse(false), 900);
  };

  return (
    <div style={{ ...box, display: 'grid', gap: 12 }} aria-label="Papan simulator Robotku">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) 1fr', gap: 12, alignItems: 'start' }}>
        {/* board */}
        <div>
          <BoardSvg rgb={rgb} buzzerActive={buzzerActive} linkState="off" ports={ports} onPortClick={attach} />
          {pending && (
            <div style={{ fontSize: 12, color: '#F5C518', marginTop: 4 }}>
              Klik kolom port {pending === 'servo' ? 'PWM (bawah)' : 'I2C (atas)'} untuk memasang {pending === 'servo' ? 'Servo' : 'OLED'}.
            </div>
          )}
        </div>

        {/* attached modules */}
        <div style={{ display: 'grid', gap: 10 }}>
          {plugged.length === 0 && (
            <div style={{ fontSize: 12, color: '#9DB0C9' }}>Belum ada modul. Pasang Servo atau OLED di bawah.</div>
          )}
          {plugged.map(([id, kind]) => (
            <div key={id} style={{ ...box, padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9DB0C9', marginBottom: 4 }}>→ {id}</div>
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
      </div>

      {/* Pasang modul */}
      <div style={{ ...box, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#cdd6e6' }}>Pasang modul:</span>
        <button onClick={() => setPending('servo')} aria-pressed={pending === 'servo'} style={btn(pending === 'servo')}>
          Servo SG90
        </button>
        <button onClick={() => setPending('oled')} aria-pressed={pending === 'oled'} style={btn(pending === 'oled')}>
          Layar OLED
        </button>
      </div>

      {/* Coba langsung (simulator only) */}
      <div style={{ ...box, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#cdd6e6' }}>
          Coba langsung <em style={{ color: '#9DB0C9', fontWeight: 400 }}>(hanya simulator)</em>:
        </span>
        <input
          type="text"
          placeholder="Teks OLED…"
          aria-label="Teks OLED simulator"
          onChange={(e) => setManualText(e.target.value || null)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ffffff22', background: '#0d1b30', color: '#eaf6ff' }}
        />
        <button onClick={pressBuzz} style={btn(false)}>
          Bunyi buzzer
        </button>
        <button
          onClick={() => {
            if (typeof window === 'undefined' || !window.speechSynthesis) return;
            const u = new SpeechSynthesisUtterance(manualText || 'Hello');
            u.lang = 'id-ID';
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          }}
          style={btn(false)}
        >
          🔊 Bicara
        </button>
      </div>

      {/* Warna LED — real hex color wheel that drives the RGB LED on the robot */}
      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#cdd6e6' }}>Warna LED (RGB):</span>
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
        <span style={{ fontSize: 12, color: '#9DB0C9', fontFamily: 'monospace' }}>{manualRgb ?? '#ff0000'}</span>
        <em style={{ fontSize: 11, color: '#9DB0C9' }}>roda warna + hex, langsung ke LED asli</em>
      </div>

      {/* Gambar pixel -> OLED (draw, then send to the real screen) */}
      <div style={{ ...box, display: 'grid', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#cdd6e6' }}>
          Gambar pixel (OLED) <em style={{ color: '#9DB0C9', fontWeight: 400 }}>— gambar, lalu Kirim ke OLED</em>
        </span>
        <PixelEditor onSend={setBitmap} />
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
    border: `1px solid ${active ? '#8085F4' : '#ffffff22'}`,
    background: active ? 'rgba(129,133,244,0.22)' : 'rgba(255,255,255,0.04)',
    color: '#eaf6ff',
    cursor: 'pointer',
  };
}
