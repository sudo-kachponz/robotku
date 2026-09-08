// src/components/blockcoding/sim/OledModule.tsx
//
// External 0.96" SSD1306 OLED module (4.md): toska 3D frame, blue PCB, 4 labelled
// pins, black screen. The screen renders REAL content (text / 5x5 matrix / shape),
// not a placeholder, so DISPLAY_TEXT etc. look alive in the sim.

import { useMemo } from 'react';
import styles from './SimBoard.module.css';

// Colors matched to the real 0.96" I2C OLED module photo.
const C = {
  pcb: '#1E63B0', // module blue
  pcbEdge: '#12406F',
  screen: '#050608', // black (off) glass
  on: '#3BE8F5', // blue-cyan lit pixels
  off: 'rgba(59,232,245,0.05)',
  hole: '#D7DBE2', // silver mounting-hole ring
  holeIn: '#7C828C',
  pin: '#E7C24A', // gold header pin
  label: '#EAF1FF',
  connector: '#0E0E0E',
  wires: ['#E23B2E', '#3A3A3A', '#2FA84F', '#2E6BE0'], // GND, VCC, SCL, SDA
} as const;
const PINS = ['GND', 'VCC', 'SCL', 'SDA'];

interface Props {
  text?: string;
  line2?: string;
  matrix?: boolean[]; // 25 cells, row-major
  shape?: string | null;
  bitmap?: { w: number; h: number; pixels: string } | null; // pixel-art grid ('0'/'1')
  dimmed?: boolean;
}

function Shape({ shape }: { shape: string }) {
  const stroke = C.on;
  switch (shape) {
    case 'heart':
      return <path d="M64 44 C 54 30, 34 34, 44 50 L 64 66 L 84 50 C 94 34, 74 30, 64 44 Z" fill={stroke} />;
    case 'smile':
      return (
        <g fill="none" stroke={stroke} strokeWidth={3}>
          <circle cx={64} cy={40} r={22} />
          <circle cx={56} cy={34} r={2.5} fill={stroke} />
          <circle cx={72} cy={34} r={2.5} fill={stroke} />
          <path d="M54 46 Q64 56 74 46" />
        </g>
      );
    case 'sad':
      return (
        <g fill="none" stroke={stroke} strokeWidth={3}>
          <circle cx={64} cy={40} r={22} />
          <path d="M54 50 Q64 40 74 50" />
        </g>
      );
    case 'left_arrow':
      return <path d="M78 24 L46 40 L78 56 Z" fill={stroke} />;
    case 'right_arrow':
      return <path d="M50 24 L82 40 L50 56 Z" fill={stroke} />;
    case 'star':
      return <path d="M64 20 l7 16 18 2 -13 12 4 18 -16 -9 -16 9 4 -18 -13 -12 18 -2 Z" fill={stroke} />;
    default:
      return <circle cx={64} cy={40} r={18} fill="none" stroke={stroke} strokeWidth={3} />;
  }
}

export default function OledModule({ text, line2, matrix, shape, bitmap, dimmed }: Props) {
  const longText = (text?.length ?? 0) > 10;
  // Render an arbitrary WxH bitmap efficiently as one image (a 128x64 grid = 8192
  // pixels; SVG rects would freeze) via an offscreen canvas -> data URL.
  const bmpUrl = useMemo(() => {
    if (!bitmap || bitmap.w <= 0 || bitmap.h <= 0 || typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = bitmap.w;
    cv.height = bitmap.h;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    const img = cx.createImageData(bitmap.w, bitmap.h);
    for (let i = 0; i < bitmap.w * bitmap.h; i++) {
      const o = i * 4;
      img.data[o] = 59; // #3BE8F5
      img.data[o + 1] = 232;
      img.data[o + 2] = 245;
      img.data[o + 3] = bitmap.pixels[i] === '1' ? 255 : 0;
    }
    cx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }, [bitmap]);
  return (
    <svg viewBox="0 0 150 116" role="img" aria-label="Modul layar OLED 0.96 inci" style={{ width: '100%', height: 'auto', opacity: dimmed ? 0.5 : 1 }}>
      {/* jumper wires into the header: GND red, VCC dark, SCL green, SDA blue */}
      {PINS.map((_, i) => (
        <line key={`w${i}`} x1={59 + i * 13} y1={0} x2={59 + i * 13} y2={15} stroke={C.wires[i]} strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* blue PCB */}
      <rect x={6} y={12} width={138} height={98} rx={6} fill={C.pcb} stroke={C.pcbEdge} strokeWidth={1.5} />
      {/* 4 corner mounting holes */}
      {[[20, 26], [130, 26], [20, 96], [130, 96]].map(([cx, cy], i) => (
        <g key={`h${i}`}>
          <circle cx={cx} cy={cy} r={6} fill={C.hole} />
          <circle cx={cx} cy={cy} r={3} fill={C.holeIn} />
        </g>
      ))}
      {/* gold header pins + white labels */}
      {PINS.map((label, i) => (
        <g key={label}>
          <rect x={56 + i * 13} y={12} width={6} height={7} rx={1.5} fill={C.pin} />
          <text x={59 + i * 13} y={30} textAnchor="middle" fontSize={5.5} fontWeight={800} fill={C.label}>
            {label}
          </text>
        </g>
      ))}
      {/* black screen glass */}
      <rect x={20} y={36} width={110} height={54} rx={2} fill={C.screen} stroke="#0b1420" />
      {/* bottom connector tab */}
      <rect x={60} y={102} width={30} height={7} rx={1.5} fill={C.connector} />
      <svg x={20} y={36} width={110} height={54} viewBox="0 0 128 64">
        {bmpUrl ? (
          <image href={bmpUrl} x={0} y={0} width={128} height={64} style={{ imageRendering: 'pixelated' }} />
        ) : matrix ? (
          Array.from({ length: 25 }, (_, i) => (
            <rect
              key={i}
              x={24 + (i % 5) * 16}
              y={2 + Math.floor(i / 5) * 12}
              width={13}
              height={10}
              rx={2}
              fill={matrix[i] ? C.on : C.off}
            />
          ))
        ) : shape ? (
          <Shape shape={shape} />
        ) : (
          <>
            <text
              x={4}
              y={26}
              fontSize={18}
              fontFamily="monospace"
              fontWeight={700}
              fill={C.on}
              className={longText ? styles.oledMarquee : undefined}
            >
              {text || ''}
            </text>
            {line2 && (
              <text x={4} y={50} fontSize={14} fontFamily="monospace" fill={C.on}>
                {line2.slice(0, 12)}
              </text>
            )}
          </>
        )}
      </svg>
    </svg>
  );
}
