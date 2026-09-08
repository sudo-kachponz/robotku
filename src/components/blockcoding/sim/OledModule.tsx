// src/components/blockcoding/sim/OledModule.tsx
//
// External 0.96" SSD1306 OLED module, photorealistically matching the hardware photo
// (Photo 3): Mint/toska 3D enclosure, top rainbow ribbon cable (Blue, Green, Yellow, Orange),
// "1 GND VDD SCK SDA 4" silkscreen, Phillips screws, gold polyimide flex tab, and active OLED display.

import { useMemo } from 'react';
import styles from './SimBoard.module.css';

// Colors matched to the real 0.96" OLED module photo
const C = {
  casing: '#2FC49A',
  casingLight: '#4DE6BC',
  casingDark: '#1FA680',
  pcb: '#154284',
  pcbEdge: '#0C2A56',
  screen: '#05070C',
  on: '#38BDF8', // vivid OLED cyan-blue lit pixels
  off: 'rgba(56, 189, 248, 0.04)',
  screwHead: '#CBD5E1',
  screwSlot: '#475569',
  washer: '#94A3B8',
  solderPad: '#E2E8F0',
  flexGold: '#D97706',
  flexBlack: '#18181B',
  // Rainbow ribbon wires matching photo: 1:Blue, 2:Green, 3:Yellow, 4:Orange
  wires: [
    { core: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
    { core: '#16A34A', light: '#4ADE80', dark: '#15803D' },
    { core: '#EAB308', light: '#FDE047', dark: '#CA8A04' },
    { core: '#EA580C', light: '#FB923C', dark: '#C2410C' },
  ],
} as const;

interface Props {
  text?: string;
  line2?: string;
  matrix?: boolean[];
  shape?: string | null;
  bitmap?: { w: number; h: number; pixels: string } | null;
  dimmed?: boolean;
}

function Shape({ shape }: { shape: string }) {
  const stroke = C.on;
  switch (shape) {
    case 'heart':
      return <path d="M64 44 C 54 30, 34 34, 44 50 L 64 66 L 84 50 C 94 34, 74 30, 64 44 Z" fill={stroke} />;
    case 'smile':
      return (
        <g fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round">
          <circle cx={64} cy={40} r={22} />
          <circle cx={56} cy={34} r={2.5} fill={stroke} />
          <circle cx={72} cy={34} r={2.5} fill={stroke} />
          <path d="M54 46 Q64 56 74 46" />
        </g>
      );
    case 'sad':
      return (
        <g fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round">
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
      img.data[o] = 56;
      img.data[o + 1] = 189;
      img.data[o + 2] = 248;
      img.data[o + 3] = bitmap.pixels[i] === '1' ? 255 : 0;
    }
    cx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }, [bitmap]);

  return (
    <svg
      viewBox="0 0 160 134"
      role="img"
      aria-label="Modul layar OLED 0.96 inci"
      style={{ width: '100%', height: 'auto', display: 'block', opacity: dimmed ? 0.5 : 1 }}
    >
      <defs>
        <linearGradient id="oledCaseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.casingLight} />
          <stop offset="30%" stopColor={C.casing} />
          <stop offset="100%" stopColor={C.casingDark} />
        </linearGradient>
        <radialGradient id="oledScrewGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor={C.screwHead} />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>
      </defs>

      {/* ── Top Rainbow Ribbon Cable Bending Upwards (Photo 3) ── */}
      {C.wires.map((wire, i) => {
        const x = 65 + i * 10;
        const d = `M ${x} 18 C ${x} 8, ${x + 6} 2, ${x + 10} 0`;
        return (
          <g key={`cable-in-${i}`}>
            {/* Wire outer insulation */}
            <path d={d} fill="none" stroke={wire.dark} strokeWidth={4.4} strokeLinecap="round" />
            {/* Core color */}
            <path d={d} fill="none" stroke={wire.core} strokeWidth={3.6} strokeLinecap="round" />
            {/* Specular highlight */}
            <path d={d} fill="none" stroke={wire.light} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
            {/* Live animated data pulse */}
            <path
              d={d}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeDasharray="3 8"
              className={styles.wireFlow}
              opacity={0.8}
            />
          </g>
        );
      })}

      {/* ── Mint/Toska 3D Printed Outer Frame (Photo 3) ── */}
      <rect x={6} y={12} width={148} height={118} rx={14} fill="url(#oledCaseGrad)" />
      {/* Top and bottom frame bezel cutouts */}
      <rect x={40} y={10} width={80} height={4} rx={2} fill="#0F172A" opacity={0.2} />
      <rect x={40} y={126} width={80} height={4} rx={2} fill="#0F172A" opacity={0.2} />

      {/* ── Navy PCB Base (Photo 3) ── */}
      <rect x={14} y={18} width={132} height={106} rx={6} fill={C.pcb} stroke={C.pcbEdge} strokeWidth={1.5} />

      {/* ── 4 Corner Mounting Positions matching Photo 3 ── */}
      {/* Top Left: Silver Solder Ring */}
      <circle cx={24} cy={28} r={5.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
      <circle cx={24} cy={28} r={3.5} fill="#475569" />
      {/* Top Right: Phillips Screw with Washer */}
      <circle cx={136} cy={28} r={6.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
      <circle cx={136} cy={28} r={4.5} fill="url(#oledScrewGrad)" />
      <line x1={133} y1={28} x2={139} y2={28} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
      <line x1={136} y1={25} x2={136} y2={31} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
      {/* Bottom Left: Phillips Screw with Washer */}
      <circle cx={24} cy={114} r={6.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
      <circle cx={24} cy={114} r={4.5} fill="url(#oledScrewGrad)" />
      <line x1={21} y1={114} x2={27} y2={114} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
      <line x1={24} y1={111} x2={24} y2={117} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
      {/* Bottom Right: Silver Solder Ring */}
      <circle cx={136} cy={114} r={5.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
      <circle cx={136} cy={114} r={3.5} fill="#475569" />

      {/* ── Top Header Solder Pads & Silkscreen (Photo 3) ── */}
      {/* 4 Silver Solder Joints */}
      {[65, 75, 85, 95].map((px) => (
        <g key={`solder-${px}`}>
          <circle cx={px} cy={18} r={3} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.8} />
          <circle cx={px} cy={18} r={1.4} fill="#64748B" />
        </g>
      ))}
      {/* Exact Silkscreen: "1 GND VDD SCK SDA 4" */}
      <text x={48} y={29} fontSize={5.5} fontWeight={900} fill="#FFFFFF">
        1
      </text>
      <text x={65} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">
        GND
      </text>
      <text x={75} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">
        VDD
      </text>
      <text x={85} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">
        SCK
      </text>
      <text x={95} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">
        SDA
      </text>
      <text x={112} y={29} fontSize={5.5} fontWeight={900} fill="#FFFFFF">
        4
      </text>

      {/* ── Deep Obsidian OLED Screen Glass (Photo 3) ── */}
      <rect x={20} y={35} width={120} height={66} rx={3} fill={C.screen} stroke="#090F1A" strokeWidth={1.5} />
      <rect x={23} y={38} width={114} height={60} fill="#030508" />

      {/* ── Bottom Flex Cable & Plastic Support Bracket (Photo 3) ── */}
      {/* Amber Polyimide Flex Tab */}
      <rect x={55} y={98} width={50} height={16} fill={C.flexGold} opacity={0.85} />
      <line x1={65} y1={98} x2={65} y2={114} stroke="#B45309" strokeWidth={1} />
      <line x1={75} y1={98} x2={75} y2={114} stroke="#B45309" strokeWidth={1} />
      <line x1={85} y1={98} x2={85} y2={114} stroke="#B45309" strokeWidth={1} />
      <line x1={95} y1={98} x2={95} y2={114} stroke="#B45309" strokeWidth={1} />
      {/* Black Plastic Support Clamp */}
      <rect x={50} y={102} width={60} height={12} rx={2} fill={C.flexBlack} stroke="#27272A" strokeWidth={0.8} />

      {/* ── Active OLED Display Content (128x64 Grid) ── */}
      <svg x={24} y={39} width={112} height={58} viewBox="0 0 128 64">
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
              fontSize={17}
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

