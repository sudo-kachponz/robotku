// src/components/blockcoding/sim/PixelEditor.tsx
//
// Draw pixel art on a grid sized like the OLED (cyan on black), then "Kirim ke
// OLED" sends DISPLAY_BITMAP to the connected robot AND previews it in the sim.
// 16x8 grid = chunky, kid-drawable; the firmware scales it to fill 128x64.

import { useRef, useState } from 'react';
import { useDrive } from '../../../hooks/useDrive';

const W = 16;
const H = 8;
const ON = '#3BE8F5'; // blue-cyan, same as the real OLED pixels

export interface Bitmap {
  w: number;
  h: number;
  pixels: string;
}

// 16x8 pixel-art templates (row-major '0'/'1'). Chunky by design — the OLED is
// mono 128x64 and the editor is a 16x8 grid, so each cell is an 8x8 block.
const TEMPLATES: Record<string, string> = {
  '— Template —': '', // placeholder: clears the grid
  '♥ Hati':
    '0001100000011000' +
    '0011110000111100' +
    '0111111001111110' +
    '0111111111111110' +
    '0011111111111100' +
    '0001111111111000' +
    '0000011111100000' +
    '0000000110000000',
  '🎂 Happy Birthday':
    '0001000100010000' +
    '0001000100010000' +
    '0111111111111100' +
    '1111111111111110' +
    '1111111111111111' +
    '1111111111111111' +
    '1101101101101101' +
    '1111111111111111',
  '👾 Invader':
    '0000100000100000' +
    '0000010001000000' +
    '0000011111100000' +
    '0001101110110000' +
    '0011111111111000' +
    '0010111111101000' +
    '0010100000101000' +
    '0000001101100000',
  '☺ Smiley':
    '0001111111111000' +
    '0111111111111110' +
    '0111001111001110' +
    '0111111111111110' +
    '0111111111111110' +
    '0111100000011110' +
    '0011111111111100' +
    '0001111111111000',
  '🐱 Kucing':
    '0110000000000110' +
    '1111000000001111' +
    '1111111111111111' +
    '1111111111111111' +
    '1100110000110011' +
    '1111111111111111' +
    '0111101111011110' +
    '0011111111111100',
};

export default function PixelEditor({ onSend }: { onSend?: (b: Bitmap) => void }) {
  const { sendCommand } = useDrive();
  const [cells, setCells] = useState<boolean[]>(() => Array(W * H).fill(false));
  const painting = useRef(false);
  const paintVal = useRef(true);

  const paint = (i: number, v: boolean) =>
    setCells((prev) => {
      if (prev[i] === v) return prev;
      const next = [...prev];
      next[i] = v;
      return next;
    });

  const bitmap = (): Bitmap => ({ w: W, h: H, pixels: cells.map((c) => (c ? '1' : '0')).join('') });

  const send = () => {
    const b = bitmap();
    sendCommand('DISPLAY_BITMAP', { ...b }); // to the robot (no-op if offline)
    onSend?.(b); // to the sim OLED
  };

  const loadTemplate = (name: string) => {
    const t = TEMPLATES[name];
    if (t && t.length === W * H) setCells(t.split('').map((c) => c === '1'));
    else setCells(Array(W * H).fill(false)); // placeholder / bad length -> clear
  };

  return (
    <div>
      <select
        aria-label="Pilih template pixel art"
        defaultValue="— Template —"
        onChange={(e) => loadTemplate(e.target.value)}
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '4px 8px',
          marginBottom: 8,
          borderRadius: 6,
          border: '1px solid #ffffff22',
          background: '#0d1b30',
          color: '#eaf6ff',
          cursor: 'pointer',
        }}
      >
        {Object.keys(TEMPLATES).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <div
        role="grid"
        aria-label="Editor pixel untuk layar OLED"
        onPointerUp={() => (painting.current = false)}
        onPointerLeave={() => (painting.current = false)}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${W}, 1fr)`,
          gap: 1,
          background: '#04090c',
          padding: 6,
          borderRadius: 8,
          width: 'min(100%, 384px)',
          touchAction: 'none',
        }}
      >
        {cells.map((on, i) => (
          <div
            key={i}
            role="gridcell"
            aria-label={`Pixel baris ${Math.floor(i / W) + 1} kolom ${(i % W) + 1}${on ? ' menyala' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              painting.current = true;
              paintVal.current = !on;
              paint(i, !on);
            }}
            onPointerEnter={() => painting.current && paint(i, paintVal.current)}
            style={{ aspectRatio: '1', borderRadius: 2, cursor: 'pointer', background: on ? ON : 'rgba(59,232,245,0.10)' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={send} style={btn(true)}>
          Kirim ke OLED
        </button>
        <button onClick={() => setCells(Array(W * H).fill(false))} style={btn(false)}>
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
