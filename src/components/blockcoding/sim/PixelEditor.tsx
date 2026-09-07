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

  return (
    <div>
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
