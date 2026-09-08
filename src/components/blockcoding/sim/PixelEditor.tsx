// src/components/blockcoding/sim/PixelEditor.tsx
//
// Full-resolution OLED pixel editor: a 128x64 <canvas> (the panel's native res, so
// complex art is possible). Draw with click/drag, load templates (incl. a Miku
// decoded from braille art), then "Kirim ke OLED" sends DISPLAY_BITMAP to the robot
// and previews it in the sim. Canvas (not 8192 divs) keeps dragging smooth.

import { useEffect, useRef } from 'react';
import { useDrive } from '../../../hooks/useDrive';

const W = 128;
const H = 64;
const SCALE = 4; // on-screen px per pixel -> 512x256 canvas
const ON = '#3BE8F5';
const OFF = '#04090c';

export interface Bitmap {
  w: number;
  h: number;
  pixels: string;
}

// ── template builders (each returns a 128x64 grid) ──
function blank(): Uint8Array {
  return new Uint8Array(W * H);
}
// Nearest-neighbor scale a small '0'/'1' art (sw x sh) up, centered, aspect-fit.
function fit(src: Uint8Array, sw: number, sh: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const scale = Math.min(W / sw, H / sh);
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);
  const ox = Math.floor((W - dw) / 2);
  const oy = Math.floor((H - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      if (src[sy * sw + sx]) out[(oy + y) * W + (ox + x)] = 1;
    }
  }
  return out;
}
function fromStr(str: string, sw: number, sh: number): Uint8Array {
  const src = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) src[i] = str[i] === '1' ? 1 : 0;
  return fit(src, sw, sh);
}
// Decode Unicode braille art (each char = 2x4 dots) into a fitted 128x64 grid.
const BRAILLE_DOT: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3], // bits 0..7 = dots 1..8
];
function fromBraille(lines: string[]): Uint8Array {
  const cols = Math.max(...lines.map((l) => [...l].length));
  const dw = cols * 2;
  const dh = lines.length * 4;
  const src = new Uint8Array(dw * dh);
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const code = (ch.codePointAt(0) ?? 0) - 0x2800;
      if (code < 0 || code > 0xff) return;
      for (let b = 0; b < 8; b++) {
        if (code & (1 << b)) {
          const [dx, dy] = BRAILLE_DOT[b];
          src[(r * 4 + dy) * dw + (c * 2 + dx)] = 1;
        }
      }
    });
  });
  return fit(src, dw, dh);
}

const HEART_16 =
  '0001100000011000001111000011110001111110011111100111111111111110001111111111110000011111111110000000011111100000000000011000000000';
const CAKE_16 =
  '0001000100010000000100010001000001111111111111001111111111111110111111111111111111111111111111111101101101101101111111111111111111';

const MIKU_BRAILLE = [
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⢿⣿⣿⣿⣿⣿⡿⠟⢛⣋⣩⣥⣤⣤⣤⣤⣍⣉⠛⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⡿⠋⣠⣴⣶⡤⠈⣡⠌⢉⣥⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣤⡉⠛⢛⠛⠋⣡⣤⣉⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⡿⠋⣠⣾⣿⣿⠟⣡⠞⢁⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣌⠳⣄⠹⣿⣿⣷⣄⠙⢿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⠟⢁⣼⣿⣿⡿⠋⡴⢁⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡈⢣⡈⢿⣿⣿⣷⣄⠻⣿⣿⣿⣿⣿',
  '⣿⡿⠃⣴⣿⣿⣿⡿⢁⠎⢠⣿⣿⣿⣿⣿⣿⣿⡟⣿⣿⣿⣿⣿⡟⣿⣿⣿⣿⣿⣿⣿⣿⢿⣿⣿⣿⣄⠹⡄⠹⣿⣿⣿⣦⡈⢿⣿⣿⣿',
  '⡟⢁⣾⣿⣿⣿⣿⣧⠈⣰⡟⣹⣿⣿⣿⣿⣿⣿⠃⢹⣿⣿⣿⣿⣷⠘⣿⣿⣿⣿⣿⣿⣿⣶⣝⢿⣿⣿⣆⠙⠀⣿⣿⣿⣿⣷⡄⠹⣿⣿',
  '⢠⣿⣿⣿⣿⣿⣿⠇⣰⡟⠀⣿⣿⣿⣿⣿⣿⡟⢠⠈⣿⣿⣿⣿⣿⡀⡈⢻⣿⣿⣿⣿⣿⣿⣿⣧⡈⠻⣿⡆⢸⣿⣿⣿⣿⣿⣿⣆⠙⣿',
  '⣿⣿⣿⣿⣿⣿⡟⢰⡟⠀⢸⣿⣿⣿⣿⣿⢣⡇⣼⣇⠸⣿⣿⣿⣿⣇⠹⣆⠙⢿⣿⣿⣿⣿⣿⣿⣿⡄⠙⢿⡄⢿⣿⣿⣿⣿⣿⣿⣧⠘',
  '⣿⣿⣿⣿⣿⣿⠁⡾⢠⡇⣸⣿⣿⣿⣿⡿⠈⠀⣿⣿⣆⠹⣿⣿⣿⣿⡄⢻⣧⣄⠹⣿⣿⣿⣿⣿⣿⣿⣄⠀⠁⢸⣿⣿⣿⣿⣿⣿⣿⣧',
  '⣿⣿⣿⣿⣿⣿⠠⠃⣾⡇⢻⣿⣿⣿⣿⡇⠀⢈⣭⣭⣽⣆⠘⢿⣿⣿⣷⡈⢿⣿⠇⠀⠙⢿⣿⣿⣿⣿⣿⡄⢠⠀⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⠀⢸⣿⠃⢸⣿⣿⣿⣿⠇⠇⠸⠿⠿⢿⣿⣷⣄⠙⢿⣿⣧⠈⠃⠀⠀⠀⡄⠙⠻⣿⣿⣿⣷⠈⣷⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⠀⣿⣿⠀⠈⣿⣿⣿⣿⠀⢰⣴⢡⠀⠀⠈⠹⣿⣷⣄⠙⠻⣷⡀⢢⣀⣠⠇⣿⣦⢈⠙⢿⣿⡇⢸⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣷⣿⣿⡆⣄⠹⣿⣿⣿⡄⠀⢻⡸⡄⠀⠀⡆⣿⣿⣿⣿⣦⣄⣉⠂⠉⢥⣾⣿⡟⢸⣿⣦⣈⠛⢸⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢸⡄⠹⣿⣿⡇⢂⠹⣷⣜⣳⣟⣡⣿⣿⣿⣟⣿⣿⣿⣿⣶⣤⣽⡿⢁⣿⣿⣿⣿⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠸⣿⣆⠙⣿⣧⠈⢧⡈⢿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠛⠛⣿⣿⡿⠁⣾⣿⣿⣿⡟⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣿⣿⣧⡈⠻⠀⣄⠙⠀⠙⠿⠟⠉⣟⠁⢀⣤⣴⡖⣸⣿⠏⣠⠀⣿⣿⣿⣿⠇⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢸⣿⣿⣿⣦⣄⣻⣷⣦⣤⣤⣄⡘⠛⠷⢬⣭⣩⡴⠟⣁⣼⡿⠂⣠⣤⣉⠛⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠆⠐⣶⣤⣤⣴⣾⡿⢋⣤⡾⢋⣴⣌⠁⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⠟⡡⣰⠀⣿⣿⣿⠿⢋⣴⠾⣋⣴⣿⡿⠃⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
];

const TEMPLATES: Record<string, () => Uint8Array> = {
  '— Template —': blank,
  '♥ Hati': () => fromStr(HEART_16, 16, 8),
  '🎂 Happy Birthday': () => fromStr(CAKE_16, 16, 8),
  '🎤 Hatsune Miku': () => fromBraille(MIKU_BRAILLE),
};

export default function PixelEditor({ onSend }: { onSend?: (b: Bitmap) => void }) {
  const { sendCommand } = useDrive();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useRef<Uint8Array>(new Uint8Array(W * H));
  const painting = useRef(false);
  const paintVal = useRef(1);

  const redraw = () => {
    const c = canvasRef.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = OFF;
    c.fillRect(0, 0, W * SCALE, H * SCALE);
    c.fillStyle = ON;
    for (let i = 0; i < W * H; i++) {
      if (grid.current[i]) c.fillRect((i % W) * SCALE, Math.floor(i / W) * SCALE, SCALE, SCALE);
    }
  };
  useEffect(redraw, []);

  const cellOf = (e: React.PointerEvent): number | null => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - rect.left) / rect.width) * W);
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * H);
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return null;
    return cy * W + cx;
  };
  const paint = (e: React.PointerEvent) => {
    const i = cellOf(e);
    if (i == null || grid.current[i] === paintVal.current) return;
    grid.current[i] = paintVal.current;
    const c = canvasRef.current?.getContext('2d');
    if (c) {
      c.fillStyle = paintVal.current ? ON : OFF;
      c.fillRect((i % W) * SCALE, Math.floor(i / W) * SCALE, SCALE, SCALE);
    }
  };

  const send = () => {
    let s = '';
    for (let i = 0; i < W * H; i++) s += grid.current[i] ? '1' : '0';
    const b = { w: W, h: H, pixels: s };
    sendCommand('DISPLAY_BITMAP', { ...b });
    onSend?.(b);
  };

  return (
    <div>
      <select
        aria-label="Pilih template pixel art"
        defaultValue="— Template —"
        onChange={(e) => {
          grid.current = (TEMPLATES[e.target.value] ?? blank)();
          redraw();
        }}
        style={{ fontSize: 12, fontWeight: 700, padding: '4px 8px', marginBottom: 8, borderRadius: 6, border: '1px solid #ffffff22', background: '#0d1b30', color: '#eaf6ff', cursor: 'pointer' }}
      >
        {Object.keys(TEMPLATES).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <canvas
        ref={canvasRef}
        width={W * SCALE}
        height={H * SCALE}
        aria-label="Kanvas pixel 128x64 untuk layar OLED"
        onPointerDown={(e) => {
          e.preventDefault();
          const i = cellOf(e);
          if (i == null) return;
          painting.current = true;
          paintVal.current = grid.current[i] ? 0 : 1;
          paint(e);
        }}
        onPointerMove={(e) => painting.current && paint(e)}
        onPointerUp={() => (painting.current = false)}
        onPointerLeave={() => (painting.current = false)}
        style={{ width: '100%', maxWidth: 512, height: 'auto', imageRendering: 'pixelated', background: OFF, borderRadius: 6, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={send} style={btn(true)}>
          Kirim ke OLED
        </button>
        <button
          onClick={() => {
            grid.current = new Uint8Array(W * H);
            redraw();
          }}
          style={btn(false)}
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: 8,
    border: `1px solid ${primary ? '#3BE8F5' : '#ffffff22'}`,
    background: primary ? 'rgba(59,232,245,0.18)' : 'rgba(255,255,255,0.04)',
    color: '#eaf6ff',
    cursor: 'pointer',
  };
}
