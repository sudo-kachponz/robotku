// src/components/blockcoding/sim/MakerkitBoardArt.tsx
//
// The Robotku Makerkit V1.3 board, drawn 1:1 from the real board photo: white PCB
// with black silkscreen in its black 3D-printed case (USB-C breakout, INMP441 mic,
// buzzer, WIFI/BT/POWER LEDs, 4x WS2812B, ESP32-S3 module, TOUCH 1, MAX98357A
// speaker amp, I2C BUS, SERVO/AUX, DISTANCE_SENSOR, INPUT & OUTPUT, UART, RESET).
// ONE drawing shared by every asset that shows the PCB: the Block Coding simulator
// (BoardSvg adds clickable headers + wires on top), the Base Robot art and the robot
// sprite. Board-local units 390x300; place it with a parent transform. Gradient IDs
// are prefixed per instance so several boards can share a page.

import { useId, type ReactNode } from 'react';
import styles from './SimBoard.module.css';

type Pt = [number, number];

// ─── Palette (matched to the Makerkit V1.3 photo) ───────────────────────────
export const C = {
  // Black hard case
  casing: '#1E1E21',
  casingLight: '#2E2E33',
  casingDark: '#0B0B0D',
  caseEdge: '#3A3A40',
  caseText: '#D4D4D8',
  // White PCB + black silkscreen
  pcbTop: '#FBFBF9',
  pcbBot: '#ECEDEA',
  pcbEdge: '#C9CBC6',
  silk: '#1A1A1A',
  silkDim: '#4B4B4B',
  via: '#B8BBB5',
  // Header plastic colors
  hBlack: '#1C1917',
  hRed: '#DC2626',
  hYellow: '#EAB308',
  hWhite: '#F1F1EE',
  // Parts
  shieldGradTop: '#E4E6EA',
  shieldGradBot: '#A9AEB6',
  modulePcb: '#18181B',
  usbGreen: '#2F8F4E',
  usbGreenDark: '#1F6B38',
  usbMetal: '#C9CED6',
  buzzerBody: '#141416',
  micRing: '#E2B33C',
  speakerPurple: '#4B2A86',
  speakerPurpleEdge: '#33196A',
  touchPad: '#C8CCD2',
  screwHead: '#D1D5DB',
  screwSlot: '#475569',
  washer: '#94A3B8',
  active: '#8085F4',
  // OLED module colors (the 0.96" module's own PCB stays navy)
  oledPcb: '#154284',
  oledScreen: '#05070C',
  oledPixelOn: '#38BDF8',
  oledPixelOff: 'rgba(56, 189, 248, 0.04)',
  // Servo module colors
  servoBody: 'rgba(29, 78, 216, 0.88)',
  servoHorn: '#F8FAFC',
} as const;

// Board geometry (board-local units)
export const BW = 390;
export const BH = 300;
export const PCB = { x: 12, y: 14, w: 366, h: 272 } as const;
export const PITCH = 13; // header pitch (row + column)
export const CELL = 11; // header socket size

// Servo-style headers (top edge). Rows from the board edge inward, as silkscreened.
export const SERVO_ROWS = [
  { pin: 'GND', color: C.hBlack },
  { pin: '5V', color: C.hRed },
  { pin: 'PWM', color: C.hYellow },
] as const;
export const SERVO_Y0 = 22;

// I2C BUS header (bottom edge). Rows top→bottom as silkscreened.
export const I2C_ROWS = [
  { pin: 'SDA', color: C.hYellow },
  { pin: 'SCL', color: C.hWhite },
  { pin: 'VCC', color: C.hRed },
  { pin: 'GND', color: C.hBlack },
] as const;
export const I2C_Y0 = 231;

/**
 * Simulator PWM port → physical header column, left to right: P1–P3 are the
 * servo headers 1–3, P4/P5 are the AUX headers 5/6. The silkscreen numbers are
 * the board's own; change this map once the Makerkit pin map is confirmed.
 */
export const PWM_HEADER: Record<string, { x: number; silk: string }> = {
  P1: { x: 180, silk: '1' },
  P2: { x: 193, silk: '2' },
  P3: { x: 206, silk: '3' },
  P4: { x: 230, silk: '5' },
  P5: { x: 243, silk: '6' },
};
export const I2C_HEADER_X: Record<string, number> = { I1: 140, I2: 153, I3: 166, I4: 179, I5: 192 };

// ─── One header socket cell ───────────────────────────────────────────────
export const socket = (cx: number, top: number, color: string, key: string | number) => {
  const dark = color === C.hBlack;
  return (
    <g key={key}>
      <rect x={cx - CELL / 2} y={top} width={CELL} height={CELL} rx={1.6} fill={color}
            stroke={dark ? '#3F3F46' : 'rgba(0,0,0,0.35)'} strokeWidth={0.7} />
      <rect x={cx - 2.6} y={top + 2.9} width={5.2} height={5.2} rx={0.8} fill={dark ? '#000' : '#151515'}
            stroke={dark ? '#52525B' : 'none'} strokeWidth={0.5} />
      <rect x={cx - CELL / 2 + 0.8} y={top + 0.6} width={CELL - 1.6} height={1.4} rx={0.7} fill="#FFFFFF" opacity={dark ? 0.12 : 0.28} />
    </g>
  );
};

// Small silkscreen helpers ─────────────────────────────────────────────
const smd = (x: number, y: number, w = 7, h = 3.6, key?: string | number) => (
  <g key={key}>
    <rect x={x} y={y} width={w} height={h} rx={0.6} fill="#2A2A2A" />
    <rect x={x} y={y} width={1.6} height={h} fill="#C9CDD3" />
    <rect x={x + w - 1.6} y={y} width={1.6} height={h} fill="#C9CDD3" />
  </g>
);
const vias: Pt[] = [
  [58, 64], [26, 92], [92, 74], [100, 140], [36, 176], [44, 212], [24, 232], [118, 262],
  [126, 178], [170, 112], [176, 186], [190, 214], [224, 84], [250, 186], [256, 64],
  [282, 76], [300, 186], [312, 82], [372, 92], [232, 222], [212, 278], [372, 236],
];

const silkFont = "'DejaVu Sans', 'Segoe UI', system-ui, sans-serif";
const logoFont = "'Arial Black', 'Arial Rounded MT Bold', 'Plus Jakarta Sans', system-ui, sans-serif";

export default function MakerkitBoardArt({
  pixelColors = [null, null, null, null],
  buzzerActive = false,
  bleOn = false,
  wifiOn = false,
  staticHeaders = true,
  children,
}: {
  /** 4 WS2812B pixel colours (CSS) or null when dark. */
  pixelColors?: (string | null)[];
  buzzerActive?: boolean;
  bleOn?: boolean;
  wifiOn?: boolean;
  /** Draw plain SERVO/AUX + I2C BUS sockets. BoardSvg turns this off and draws clickable ones. */
  staticHeaders?: boolean;
  /** Extra overlay drawn on the board (board-local units). */
  children?: ReactNode;
}) {
  const p = `mk${useId().replace(/[^a-zA-Z0-9]/g, '')}-`;
  return (
    <g fontFamily={silkFont}>
      <defs>
        <linearGradient id={`${p}pcbGrad`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={C.pcbTop} />
          <stop offset="100%" stopColor={C.pcbBot} />
        </linearGradient>
        <linearGradient id={`${p}shieldGrad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.shieldGradTop} />
          <stop offset="55%" stopColor="#C6CAD1" />
          <stop offset="100%" stopColor={C.shieldGradBot} />
        </linearGradient>
        <linearGradient id={`${p}caseGrad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.casingLight} />
          <stop offset="18%" stopColor={C.casing} />
          <stop offset="100%" stopColor={C.casingDark} />
        </linearGradient>
        <radialGradient id={`${p}screwGrad`} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor={C.screwHead} />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>
        <radialGradient id={`${p}buzzerGrad`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#2A2A2E" />
          <stop offset="100%" stopColor="#0B0B0C" />
        </radialGradient>
        <pattern id={`${p}touchHatch`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="3" fill={C.touchPad} />
          <line x1="0" y1="0" x2="0" y2="3" stroke="#AEB3BA" strokeWidth="1" />
        </pattern>
        <filter id={`${p}ledBloom`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

    {/* Black hard case */}
    <rect x={0} y={0} width={BW} height={BH} rx={16} fill={`url(#${p}caseGrad)`} stroke={C.caseEdge} strokeWidth={1} />
    <rect x={4} y={4} width={BW - 8} height={BH - 8} rx={13} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={2} />

    {/* White PCB */}
    <rect x={PCB.x} y={PCB.y} width={PCB.w} height={PCB.h} rx={7} fill={`url(#${p}pcbGrad)`} stroke={C.pcbEdge} strokeWidth={1} />

    {/* Vias */}
    {vias.map(([vx, vy], i) => (
      <g key={`via-${i}`}>
        <circle cx={vx} cy={vy} r={1.7} fill={C.via} />
        <circle cx={vx} cy={vy} r={0.8} fill="#4A4A4A" />
      </g>
    ))}

    {/* Mounting screws */}
    {[
      [26, 27],
      [364, 27],
      [27, 273],
      [364, 274],
    ].map(([cx, cy], i) => (
      <g key={`screw-${i}`}>
        <circle cx={cx} cy={cy} r={8} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
        <circle cx={cx} cy={cy} r={6} fill={`url(#${p}screwGrad)`} />
        <line x1={cx - 3.4} y1={cy} x2={cx + 3.4} y2={cy} stroke={C.screwSlot} strokeWidth={1.3} strokeLinecap="round" />
        <line x1={cx} y1={cy - 3.4} x2={cx} y2={cy + 3.4} stroke={C.screwSlot} strokeWidth={1.3} strokeLinecap="round" />
      </g>
    ))}

    {/* ── ROBOTKU SCHOOL logo (silkscreen) ── */}
    <g transform="translate(40, 26)">
      <text x={0} y={19} fontFamily={logoFont} fontSize={19} fontWeight={900} fill="#FFFFFF" stroke={C.silk} strokeWidth={1.6}
            paintOrder="stroke" letterSpacing={-0.4}>
        R
      </text>
      {/* Mascot head as the "O" */}
      <g transform="translate(23, 11.5)">
        <circle r={8.6} fill="#FFFFFF" stroke={C.silk} strokeWidth={1.6} />
        <path d="M -7.6 -2 Q -9.8 -9 -4 -10.6" fill="none" stroke={C.silk} strokeWidth={1.3} strokeLinecap="round" />
        <rect x={-5.6} y={-4} width={11.2} height={7.6} rx={3.6} fill="none" stroke={C.silk} strokeWidth={1.1} />
        <circle cx={-2.3} cy={-0.6} r={1.05} fill={C.silk} />
        <circle cx={2.3} cy={-0.6} r={1.05} fill={C.silk} />
        <path d="M -2 4.8 Q 0 6.6 2 4.8" fill="none" stroke={C.silk} strokeWidth={1} strokeLinecap="round" />
      </g>
      <text x={33} y={19} fontFamily={logoFont} fontSize={19} fontWeight={900} fill="#FFFFFF" stroke={C.silk} strokeWidth={1.6}
            paintOrder="stroke" letterSpacing={-0.4}>
        BOTKU
      </text>
      <text x={106} y={31} textAnchor="end" fontFamily={logoFont} fontSize={8.6} fontWeight={900} fill="#FFFFFF"
            stroke={C.silk} strokeWidth={1.2} paintOrder="stroke" letterSpacing={0.4}>
        SCHOOL
      </text>
    </g>

    {/* ── Servo headers 1-2-3 + AUX 5-6 (labels; sockets come from the port columns) ── */}
    <g fontSize={6.2} fontWeight={700} fill={C.silk} textAnchor="end">
      {SERVO_ROWS.map((r, i) => (
        <text key={r.pin} x={172} y={SERVO_Y0 + i * PITCH + 8}>{r.pin}</text>
      ))}
    </g>
    <text x={236.5} y={19.5} textAnchor="middle" fontSize={6} fontWeight={800} fill={C.silk}>AUX</text>
    <rect x={169.5} y={SERVO_Y0 - 2.5} width={43} height={2 * PITCH + CELL + 5} rx={2} fill="none" stroke={C.silk} strokeWidth={0.6} />
    {Object.values(PWM_HEADER).map((h) => (
      <text key={h.silk} x={h.x} y={SERVO_Y0 + 2 * PITCH + CELL + 9} textAnchor="middle" fontSize={6.6} fontWeight={800} fill={C.silk}>
        {h.silk}
      </text>
    ))}

    {/* ── Distance sensor header (GND/TRIG/ECHO/VCC) ── */}
    <g fontSize={4} fontWeight={700} fill={C.silk} textAnchor="end">
      {['GND', 'TRIG', 'ECHO', 'VCC'].map((t, i) => (
        <text key={t} x={266} y={21 + i * 11.5 + 6.3}>{t}</text>
      ))}
    </g>
    {[0, 1, 2, 3].map((i) => (
      <g key={`dist-${i}`}>
        <rect x={268.5} y={20 + i * 11.5} width={9.5} height={9.5} rx={1.4} fill={C.hYellow} stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} />
        <rect x={271.1} y={22.6 + i * 11.5} width={4.3} height={4.3} rx={0.6} fill="#151515" />
      </g>
    ))}
    <text transform="translate(283.5, 41) rotate(90)" textAnchor="middle" fontSize={3.4} fontWeight={700} fill={C.silkDim}>
      DISTANCE_SENSOR
    </text>

    {/* ── INPUT & OUTPUT header (7 6 5 4 × VCC GND IN) ── */}
    <text x={313.5} y={19.5} textAnchor="middle" fontSize={6} fontWeight={800} fill={C.silk}>
      INPUT &amp; OUTPUT
    </text>
    {[294, 307, 320, 333].map((cx, c) =>
      [C.hRed, C.hBlack, C.hYellow].map((col, r) => socket(cx, SERVO_Y0 + r * PITCH, col, `io-${c}-${r}`))
    )}
    <g fontSize={6} fontWeight={700} fill={C.silk}>
      <text x={341} y={SERVO_Y0 + 8}>VCC</text>
      <text x={341} y={SERVO_Y0 + PITCH + 8}>GND</text>
      <text x={341} y={SERVO_Y0 + 2 * PITCH + 8}>IN</text>
    </g>
    {['7', '6', '5', '4'].map((t, i) => (
      <text key={`io-n-${t}`} x={294 + i * 13} y={SERVO_Y0 + 2 * PITCH + CELL + 9} textAnchor="middle" fontSize={6.6} fontWeight={800} fill={C.silk}>
        {t}
      </text>
    ))}

    {/* ── RESET tactile switch ── */}
    <g>
      <rect x={353} y={58} width={15} height={24} rx={2} fill="#E5E7EB" stroke="#6B7280" strokeWidth={0.8} />
      <rect x={356} y={63} width={9} height={14} rx={1.5} fill="#B0835A" stroke="#7C5A3B" strokeWidth={0.6} />
      <rect x={351} y={60} width={2} height={4} fill="#9CA3AF" />
      <rect x={351} y={76} width={2} height={4} fill="#9CA3AF" />
      <rect x={368} y={60} width={2} height={4} fill="#9CA3AF" />
      <rect x={368} y={76} width={2} height={4} fill="#9CA3AF" />
      <text transform="translate(348, 70) rotate(-90)" textAnchor="middle" fontSize={5.4} fontWeight={800} fill={C.silk}>
        RESET
      </text>
    </g>

    {/* ── USB-C breakout (overhangs the PCB edge like the real board) ── */}
    <text x={18} y={104} fontSize={7} fontWeight={700} fill={C.silk}>USB-C</text>
    <g>
      <rect x={0} y={125} width={9} height={28} rx={2.5} fill={C.usbMetal} stroke="#6B7280" strokeWidth={0.8} />
      <rect x={5} y={110} width={58} height={58} rx={3} fill={C.usbGreen} stroke={C.usbGreenDark} strokeWidth={1} />
      {[[11, 116], [27, 116], [11, 160], [27, 160]].map(([px, py], i) => (
        <rect key={`usbp-${i}`} x={px - 4} y={py - 2.4} width={8} height={5} rx={2.4} fill="#D9DDE3" stroke="#8A9099" strokeWidth={0.5} />
      ))}
      <rect x={33} y={120} width={22} height={38} rx={1} fill="none" stroke="#1C4F2C" strokeWidth={0.8} />
      {[124, 133, 142, 151].map((py, i) => (
        <g key={`usbh-${i}`}>
          <circle cx={51} cy={py} r={3.2} fill="#D9DDE3" stroke="#8A9099" strokeWidth={0.5} />
          <circle cx={51} cy={py} r={1.4} fill="#4B5563" />
        </g>
      ))}
      <circle cx={51} cy={163} r={2.2} fill="#EF4444" opacity={0.85} />
    </g>

    {/* ── Buzzer ── */}
    {buzzerActive && (
      <g fill="none" stroke="#EC2D8F" strokeWidth={2}>
        <circle cx={140} cy={96} r={6} className={styles.wave} />
        <circle cx={140} cy={96} r={6} className={`${styles.wave} ${styles.wave2}`} />
      </g>
    )}
    <circle cx={140} cy={96} r={27} fill={`url(#${p}buzzerGrad)`} stroke="#000" strokeWidth={1} />
    <circle cx={140} cy={96} r={21} fill="none" stroke="#2C2C31" strokeWidth={1} />
    <circle cx={145} cy={91} r={3.6} fill="#D4D4D8" />
    <circle cx={145} cy={91} r={1.8} fill="#71717A" />
    <text transform="translate(108, 96) rotate(-90)" textAnchor="middle" fontSize={6.4} fontWeight={800} fill={C.silk}>
      BUZZER
    </text>
    {/* bell icon */}
    <g transform="translate(103, 118)" fill="none" stroke={C.silk} strokeWidth={0.9}>
      <path d="M -3.4 2.4 Q -3.4 -3.8 0 -3.8 Q 3.4 -3.8 3.4 2.4 L 4.4 3.4 L -4.4 3.4 Z" />
      <circle cx={0} cy={4.6} r={1} fill={C.silk} />
      <path d="M -6 -3 Q -7.2 0 -6 3 M 6 -3 Q 7.2 0 6 3" />
    </g>

    {/* ── WIFI / BT status LEDs ── */}
    <g transform="translate(124, 133)" fill="none" stroke={C.silk} strokeWidth={1.1} strokeLinecap="round">
      <path d="M -5 -1 Q 0 -6 5 -1" />
      <path d="M -3 1.2 Q 0 -2 3 1.2" />
      <circle cx={0} cy={3.3} r={0.9} fill={C.silk} stroke="none" />
    </g>
    <rect x={132} y={129} width={17} height={7.5} rx={1} fill="#FFFFFF" stroke={C.silk} strokeWidth={0.9} />
    <rect
        x={136}
        y={130.5}
        width={9}
        height={4.5}
        rx={0.6}
        fill={wifiOn ? '#22C55E' : '#E4E4E7'}
        className={wifiOn ? styles.bleBlink : undefined}
      />
    <text x={152} y={135.5} fontSize={6.6} fontWeight={700} fill={C.silk}>WIFI</text>
    {smd(135, 140, 11, 5, 'r-wifi')}

    <g transform="translate(124, 159)" fill="none" stroke={C.silk} strokeWidth={1} strokeLinejoin="round">
      <path d="M -2.6 -2.6 L 2.4 2 L 0 4.4 L 0 -4.4 L 2.4 -2 L -2.6 2.6" />
    </g>
    <rect x={132} y={155} width={17} height={7.5} rx={1} fill="#FFFFFF" stroke={C.silk} strokeWidth={0.9} />
    <rect
      x={136}
      y={156.5}
      width={9}
      height={4.5}
      rx={0.6}
      fill={bleOn ? '#3B82F6' : '#E4E4E7'}
      className={bleOn ? styles.bleBlink : undefined}
    />
    <text x={152} y={161.5} fontSize={6.6} fontWeight={700} fill={C.silk}>BT</text>
    {smd(135, 166, 11, 5, 'r-bt')}

    {/* ── MIC (INMP441 round breakout) ── */}
    <circle cx={110} cy={203} r={32} fill="#E7E7E4" stroke="#B9BBB6" strokeWidth={1} />
    <circle cx={104} cy={207} r={26} fill={C.micRing} />
    <circle cx={104} cy={207} r={22.5} fill="#18181B" />
    {[[-8, -8], [0, -8], [8, -8], [-8, 0], [8, 0], [-8, 8], [0, 8], [8, 8]].map(([dx, dy], i) => (
      <g key={`micpad-${i}`}>
        <circle cx={104 + dx} cy={207 + dy} r={2.4} fill="#D6A93A" />
        <circle cx={104 + dx} cy={207 + dy} r={1} fill="#18181B" />
      </g>
    ))}
    <circle cx={104} cy={207} r={1.6} fill="none" stroke="#9CA3AF" strokeWidth={0.6} />
    <text transform="translate(73, 186) rotate(-90)" textAnchor="middle" fontSize={7} fontWeight={800} fill={C.silk}>
      MIC
    </text>
    <rect x={64} y={196} width={5} height={7} rx={1} fill="#7C2D12" opacity={0.85} />

    {/* ── POWER LED ── */}
    <g transform="translate(46, 253)" fill="none" stroke={C.silk} strokeWidth={1} strokeLinecap="round">
      <path d="M -2.8 -2.4 A 3.8 3.8 0 1 0 2.8 -2.4" />
      <line x1={0} y1={-4.2} x2={0} y2={-0.4} />
    </g>
    <text x={56} y={244} fontSize={3.6} fontWeight={700} fill={C.silkDim}>1kΩ</text>
    <circle cx={62} cy={253} r={9} fill="#EF4444" opacity={0.45} filter={`url(#${p}ledBloom)`} />
    <rect x={55} y={249} width={14} height={7.5} rx={1} fill="#FFFFFF" stroke={C.silk} strokeWidth={0.9} />
    <rect x={58.5} y={250.5} width={7} height={4.5} rx={0.6} fill="#FF3B30" />
    <text x={73} y={255.5} fontSize={7} fontWeight={700} fill={C.silk}>POWER</text>

    <text x={44} y={281} fontSize={7.6} fontWeight={700} fill={C.silk} letterSpacing={0.6}>
      MAKERKIT V1.3
    </text>

    {/* ── I2C BUS labels (sockets come from the port columns) ── */}
    <text x={166} y={226.5} textAnchor="middle" fontSize={6.8} fontWeight={800} fill={C.silk}>I2C BUS</text>
    <g fontSize={5.2} fontWeight={700} fill={C.silk}>
      {I2C_ROWS.map((r, i) => (
        <text key={`i2cl-${r.pin}`} x={200} y={I2C_Y0 + i * PITCH + 7.6}>{r.pin}</text>
      ))}
    </g>

    {/* ── LED RGB (4× WS2812B) ── */}
    {pixelColors.map((col, i) => {
      const cy = 98 + i * 24;
      return (
        <g key={`neo-${i}`}>
          <text x={191} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={C.silkDim}>{i + 1}</text>
          {col && <circle cx={208} cy={cy} r={15} fill={col} opacity={0.75} filter={`url(#${p}ledBloom)`} />}
          <rect x={199} y={cy - 9} width={18} height={18} rx={2} fill="#F4F4F5" stroke="#A1A1AA" strokeWidth={0.8} />
          <circle cx={208} cy={cy} r={6.6} fill={col ?? '#FAFAFA'} stroke={col ? 'rgba(255,255,255,0.9)' : '#D4D4D8'} strokeWidth={col ? 1.6 : 0.8} />
          {col && <circle cx={208} cy={cy} r={3} fill="#FFFFFF" opacity={0.85} />}
        </g>
      );
    })}
    <path d="M 225 103 L 228 106 L 228 166 L 225 169" fill="none" stroke={C.silk} strokeWidth={0.9} />
    <text transform="translate(235, 136) rotate(-90)" textAnchor="middle" fontSize={7} fontWeight={700} fill={C.silk} letterSpacing={0.6}>
      LED RGB
    </text>
    {smd(236, 88, 9, 4.6, 'r-470')}
    <text x={247} y={92} fontSize={3.6} fontWeight={700} fill={C.silkDim}>470Ω</text>
    {smd(238, 100, 9, 4.6, 'r-r7')}
    <text x={230} y={104} fontSize={3.8} fontWeight={700} fill={C.silkDim}>R7</text>
    <text x={240} y={98.6} fontSize={3.4} fontWeight={700} fill={C.silkDim}>4.7kΩ</text>
    {smd(203, 193, 9, 4.6, 'c8')}
    <text x={194} y={197} fontSize={3.8} fontWeight={700} fill={C.silkDim}>C8</text>
    {smd(250, 160, 6, 9, 'u-chip')}

    {/* ── ESP32-S3 module (u.FL antenna variant) ── */}
    <g>
      <rect x={257} y={93} width={121} height={89} rx={3} fill={C.modulePcb} stroke="#000" strokeWidth={0.8} />
      {Array.from({ length: 15 }, (_, i) => (
        <rect key={`cl-${i}`} x={257.5} y={97 + i * 5.6} width={3} height={3} rx={0.6} fill="#C8A24A" />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <g key={`ct-${i}`}>
          <rect x={265 + i * 5.8} y={93.5} width={3} height={3} rx={0.6} fill="#C8A24A" />
          <rect x={265 + i * 5.8} y={178.5} width={3} height={3} rx={0.6} fill="#C8A24A" />
        </g>
      ))}
      <rect x={264} y={99} width={84} height={76} rx={3} fill={`url(#${p}shieldGrad)`} stroke="#7A808C" strokeWidth={0.9} />
      <rect x={266} y={101} width={80} height={72} rx={2} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={0.8} />
      <text x={306} y={128} textAnchor="middle" fontSize={8.2} fontWeight={800} fill="#6B7280" opacity={0.8}>ESP32-S3</text>
      <text x={306} y={138} textAnchor="middle" fontSize={4.6} fontWeight={700} fill="#6B7280" opacity={0.7}>WROOM-1U</text>
      <text x={306} y={152} textAnchor="middle" fontSize={4} fontWeight={700} fill="#6B7280" opacity={0.6}>FCC CE · 2.4 GHz</text>
      {/* antenna side + u.FL connector */}
      <path d="M 352 104 H 372 M 352 112 H 372 M 352 120 H 372" stroke="#27272A" strokeWidth={1} />
      <rect x={354} y={158} width={14} height={14} rx={1.5} fill="#D6C089" stroke="#8A7340" strokeWidth={0.6} />
      <circle cx={361} cy={165} r={4.2} fill="#E9E1C6" stroke="#8A7340" strokeWidth={0.6} />
      <circle cx={361} cy={165} r={1.6} fill="#8A7340" />
    </g>

    {/* ── TOUCH 1 pad ── */}
    <text transform="translate(324, 203) rotate(-90)" textAnchor="middle" fontSize={5.6} fontWeight={800} fill={C.silk}>
      TOUCH 1
    </text>
    <rect x={327} y={185} width={41} height={37} rx={6} fill={`url(#${p}touchHatch)`} stroke="#9CA3AF" strokeWidth={0.8} />
    <rect x={329} y={187} width={37} height={10} rx={4} fill="#FFFFFF" opacity={0.35} />

    {/* ── SPEAKER: MAX98357A I2S amp breakout ── */}
    <g transform="translate(228, 212)" fill="none" stroke={C.silk} strokeWidth={0.9}>
      <path d="M -3 -2 H 0 L 3.4 -4.6 V 4.6 L 0 2 H -3 Z" fill={C.silk} />
      <path d="M 5 -3 Q 7 0 5 3" />
    </g>
    <text transform="translate(228, 254) rotate(-90)" textAnchor="middle" fontSize={7} fontWeight={800} fill={C.silk} letterSpacing={0.6}>
      SPEAKER
    </text>
    <rect x={236} y={198} width={83} height={86} rx={6} fill="none" stroke={C.silk} strokeWidth={0.7} />
    <g fontSize={3.6} fontWeight={700} fill={C.silkDim} textAnchor="middle">
      {['Vin', 'GND', 'SD', 'GAIN', 'DIN', 'BCLK', 'LRC'].map((t, i) => (
        <text key={`spk-l-${t}`} x={245 + i * 11} y={203.5}>{t}</text>
      ))}
    </g>
    <rect x={240} y={206} width={76} height={80} rx={3} fill={C.speakerPurple} stroke={C.speakerPurpleEdge} strokeWidth={1} />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <g key={`spk-p-${i}`}>
        <circle cx={245 + i * 11} cy={213} r={3.4} fill="#D9B44A" />
        <circle cx={245 + i * 11} cy={213} r={1.5} fill="#2A1550" />
      </g>
    ))}
    {smd(248, 226, 9, 4.6, 'spk-r1')}
    {smd(262, 226, 9, 4.6, 'spk-r2')}
    {smd(276, 236, 5, 9, 'spk-c1')}
    <rect x={262} y={238} width={11} height={11} rx={1} fill="#1C1C1C" />
    <g transform="translate(298, 238) rotate(180)" fontSize={4} fontWeight={800} fill="#E9D5FF" textAnchor="middle">
      <text x={0} y={0}>MAX</text>
      <text x={0} y={5}>98357A</text>
      <text x={0} y={10}>I2S Amp</text>
    </g>
    <text x={249} y={262} fontSize={7} fontWeight={800} fill="#E9D5FF">+</text>
    <text x={305} y={262} fontSize={7} fontWeight={800} fill="#E9D5FF">−</text>
    <rect x={256} y={256} width={46} height={28} rx={1.5} fill="#1F2937" stroke="#0B0F17" strokeWidth={0.8} />
    {[268, 290].map((sx) => (
      <g key={`term-${sx}`}>
        <circle cx={sx} cy={270} r={6.4} fill={`url(#${p}screwGrad)`} stroke="#475569" strokeWidth={0.6} />
        <line x1={sx - 4} y1={270} x2={sx + 4} y2={270} stroke={C.screwSlot} strokeWidth={1.2} />
      </g>
    ))}

    {/* ── UART header (VCC RX TX GND) ── */}
    {['VCC', 'RX', 'TX', 'GND'].map((t, i) => (
      <g key={`uart-${t}`}>
        <rect x={330.5} y={229 + i * 10.5} width={8.5} height={8.5} rx={1.2} fill={C.hBlack} stroke="#3F3F46" strokeWidth={0.5} />
        <rect x={332.8} y={231.3 + i * 10.5} width={3.9} height={3.9} rx={0.5} fill="#000" />
        <text x={342} y={235.6 + i * 10.5} fontSize={5} fontWeight={700} fill={C.silk}>{t}</text>
      </g>
    ))}

      {staticHeaders && (
        <g aria-hidden="true">
          {Object.values(PWM_HEADER).map((h) =>
            SERVO_ROWS.map((r, i) => socket(h.x, SERVO_Y0 + i * PITCH, r.color, `s-${h.x}-${i}`)),
          )}
          {Object.values(I2C_HEADER_X).map((x) =>
            I2C_ROWS.map((r, i) => socket(x, I2C_Y0 + i * PITCH, r.color, `i-${x}-${i}`)),
          )}
        </g>
      )}
      {children}
    </g>
  );
}
