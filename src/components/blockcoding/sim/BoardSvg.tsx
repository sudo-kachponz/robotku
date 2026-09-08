// src/components/blockcoding/sim/BoardSvg.tsx
//
// Spacious Interactive Fritzing & Schematic Wiring Canvas:
// Connects the Robotku Controller V3 directly to attached modules (OLED 0.96", SG90 Servo)
// with generous, non-overlapping orthogonal schematic wire channels, prominent pin labels,
// CAD blueprint grid, solder terminal nodes, and live animated electron signal flow.

import { useMemo } from 'react';
import styles from './SimBoard.module.css';

// Component color palette matching real photos
const C = {
  casing: '#2FC49A',
  casingLight: '#4DE6BC',
  casingDark: '#1FA680',
  pcbTop: '#13386E',
  pcbBot: '#0B244A',
  copperTrace: 'rgba(255, 255, 255, 0.08)',
  shieldGradTop: '#D8DCE3',
  shieldGradBot: '#989EA8',
  antennaPcb: '#161616',
  antennaCopper: '#C4A853',
  usbPurple: '#8E28B0',
  usbPurpleEdge: '#6B1B86',
  usbMetal: '#D1D5DB',
  buzzerBody: '#141416',
  buzzerCenter: '#0A0A0C',
  screwHead: '#D1D5DB',
  screwSlot: '#475569',
  washer: '#94A3B8',
  silk: '#FFFFFF',
  silkDim: '#9DB0C9',
  // Pin socket row colors
  i2cRows: ['#1C1917', '#DC2626', '#16A34A', '#EAB308'], // GND(black), VCC(red), SCL(green), SDA(yellow)
  pwmRows: ['#EAB308', '#DC2626', '#1C1917'], // PWM(yellow), 5V(red), GND(black)
  active: '#8085F4',
  // OLED module colors
  oledPcb: '#154284',
  oledScreen: '#05070C',
  oledPixelOn: '#38BDF8',
  oledPixelOff: 'rgba(56, 189, 248, 0.04)',
  // Servo module colors
  servoBody: 'rgba(29, 78, 216, 0.88)',
  servoHorn: '#F8FAFC',
} as const;

// Color-coded schematic wire definitions with pin meanings
const WIRE_I2C = [
  { pin: 'GND', targetPin: 'GND', name: 'GND (0V)', core: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
  { pin: 'VCC', targetPin: 'VDD', name: 'VDD (3.3V)', core: '#16A34A', light: '#4ADE80', dark: '#15803D' },
  { pin: 'SCL', targetPin: 'SCK', name: 'SCK (Clock)', core: '#EAB308', light: '#FDE047', dark: '#CA8A04' },
  { pin: 'SDA', targetPin: 'SDA', name: 'SDA (Data)', core: '#EA580C', light: '#FB923C', dark: '#C2410C' },
];

const WIRE_PWM = [
  { pin: 'PWM', targetPin: 'PWM', name: 'PWM (Sinyal)', core: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
  { pin: '5V', targetPin: '5V', name: '5V (Daya)', core: '#DC2626', light: '#F87171', dark: '#B91C1C' },
  { pin: 'GND', targetPin: 'GND', name: 'GND (0V)', core: '#78350F', light: '#92400E', dark: '#451A03' },
];

export interface PortVisual {
  id: string; // 'P1'..'P5' | 'I1'..'I5'
  kind: 'pwm' | 'i2c';
  active?: boolean;
  module?: 'servo' | 'oled' | null;
  pulsing?: boolean;
}

// Column X coordinates on the board
export const I2C_COL_X = [160, 184, 208, 232, 256];
export const PWM_COL_X = [160, 184, 208, 232, 256];

interface Props {
  rgb: { r: number; g: number; b: number } | null;
  buzzerActive: boolean;
  linkState: 'usb' | 'ble' | 'off';
  ports: PortVisual[];
  onPortClick?: (id: string) => void;
  showWires?: boolean;
  oledText?: string;
  oledShape?: string | null;
  oledMatrix?: boolean[];
  oledBitmap?: { w: number; h: number; pixels: string } | null;
  servoSpeed?: number;
}

export default function BoardSvg({
  rgb,
  buzzerActive,
  linkState,
  ports,
  onPortClick,
  showWires = true,
  oledText,
  oledShape,
  oledMatrix,
  oledBitmap,
  servoSpeed = 0,
}: Props) {
  const led = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null;
  const byId = (id: string) => ports.find((p) => p.id === id);

  // Detect attached ports
  const attachedOledPort = ports.find((p) => p.kind === 'i2c' && p.module === 'oled');
  const attachedServoPort = ports.find((p) => p.kind === 'pwm' && p.module === 'servo');
  const hasModules = !!(attachedOledPort || attachedServoPort);

  // Coordinates offset for Controller Board inside the SVG canvas
  const boardOffsetX = hasModules ? 30 : 15;
  const boardOffsetY = hasModules ? 80 : 20;

  // Generate bitmap preview URL for OLED if provided
  const bmpUrl = useMemo(() => {
    if (!oledBitmap || oledBitmap.w <= 0 || oledBitmap.h <= 0 || typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = oledBitmap.w;
    cv.height = oledBitmap.h;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    const img = cx.createImageData(oledBitmap.w, oledBitmap.h);
    for (let i = 0; i < oledBitmap.w * oledBitmap.h; i++) {
      const o = i * 4;
      img.data[o] = 56;
      img.data[o + 1] = 189;
      img.data[o + 2] = 248;
      img.data[o + 3] = oledBitmap.pixels[i] === '1' ? 255 : 0;
    }
    cx.putImageData(img, 0, 0);
    return cv.toDataURL();
  }, [oledBitmap]);

  const spinning = Math.abs(servoSpeed) > 2;
  const dur = spinning ? `${Math.max(0.35, 1.8 - Math.abs(servoSpeed) / 70).toFixed(2)}s` : undefined;
  const hornStyle: React.CSSProperties = spinning
    ? ({ ['--spin-dur' as string]: dur, animationDirection: servoSpeed < 0 ? 'reverse' : 'normal' } as React.CSSProperties)
    : { transform: 'rotate(90deg)', transformOrigin: 'center', transition: 'transform 0.2s ease' };

  // Render Port Header Column (Interactive button)
  const renderHeaderColumn = (kind: 'pwm' | 'i2c', i: number) => {
    const id = `${kind === 'pwm' ? 'P' : 'I'}${i + 1}`;
    const p = byId(id);
    const x = (kind === 'pwm' ? PWM_COL_X : I2C_COL_X)[i];
    const rows = kind === 'pwm' ? C.pwmRows : C.i2cRows;
    const y0 = kind === 'pwm' ? 222 : 36;
    const rowH = 13.5;
    const blockH = rows.length * rowH + 4;

    return (
      <g
        key={id}
        className={styles.portClick}
        role="button"
        tabIndex={0}
        aria-label={`Port ${kind === 'pwm' ? 'PWM' : 'I2C'} ${i + 1}${p?.module ? ` (${p.module})` : ''}`}
        onClick={() => onPortClick?.(id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPortClick?.(id)}
      >
        {/* Selection/active background highlight */}
        <rect
          x={x - 10}
          y={y0 - 2}
          width={20}
          height={blockH}
          rx={4}
          fill={p?.active ? 'rgba(129,133,244,0.35)' : 'transparent'}
          stroke={p?.active ? C.active : p?.pulsing ? '#F59E0B' : 'transparent'}
          strokeWidth={1.5}
        >
          {p?.pulsing && <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />}
        </rect>

        {/* 3D Color-Coded Header Sockets with Pins */}
        {rows.map((color, r) => {
          const sy = y0 + r * rowH + 1;
          return (
            <g key={r}>
              <rect x={x - 8} y={sy} width={16} height={11} rx={2} fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth={0.7} />
              <rect x={x - 5} y={sy + 2} width={10} height={7} rx={1} fill="#09090B" />
              <rect x={x - 2} y={sy + 3.5} width={4} height={4} rx={0.5} fill="#FDE047" stroke="#CA8A04" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Attached module badge dot */}
        {p?.module && (
          <circle
            cx={x}
            cy={kind === 'pwm' ? y0 + blockH + 3 : y0 - 5}
            r={3}
            fill={p.module === 'oled' ? '#2FC49A' : '#3B82F6'}
            stroke="#FFFFFF"
            strokeWidth={1}
          />
        )}

        {/* Port ID label */}
        <text
          x={x}
          y={kind === 'pwm' ? y0 - 5 : y0 + blockH + 9}
          textAnchor="middle"
          fontSize={8}
          fontWeight={800}
          fill={p?.active ? '#4F46E5' : C.silkDim}
        >
          {id}
        </text>
      </g>
    );
  };

  // Render Spacious Direct Schematic Wires: Board Port -> OLED Module
  const renderOledSchematicWires = (portId: string) => {
    const colIdx = Number(portId.slice(1)) - 1;
    const startX = boardOffsetX + I2C_COL_X[colIdx];
    // Y coordinates of GND, VCC, SCL, SDA on board
    const pinYOffsets = [
      boardOffsetY + 36 + 0 * 13.5 + 6.5,
      boardOffsetY + 36 + 1 * 13.5 + 6.5,
      boardOffsetY + 36 + 2 * 13.5 + 6.5,
      boardOffsetY + 36 + 3 * 13.5 + 6.5,
    ];
    // Spacious non-overlapping elevated horizontal routing rails (18px gaps)
    const elevatedYRails = [20, 38, 56, 74];
    // Solder terminals on OLED Module (GND, VDD, SCK, SDA with 35px pitch)
    const targetPinsX = [745, 780, 815, 850];
    const targetY = 60;

    return (
      <g key={`schematic-oled-wires-${portId}`}>
        {WIRE_I2C.map((wire, i) => {
          const py = pinYOffsets[i];
          const ry = elevatedYRails[i];
          const tx = targetPinsX[i];
          const chipX = 420 + i * 58;
          // Spacious Orthogonal schematic path with smooth 8px fillets
          const d = `M ${startX} ${py} V ${ry + 8} Q ${startX} ${ry} ${startX + 8} ${ry} H ${tx - 8} Q ${tx} ${ry} ${tx} ${ry + 8} V ${targetY}`;

          return (
            <g key={`oled-wire-${i}`}>
              {/* Soft Drop shadow */}
              <path d={d} fill="none" stroke="rgba(15,23,42,0.18)" strokeWidth={5} transform="translate(1, 3)" />
              {/* Dark insulation border */}
              <path d={d} fill="none" stroke={wire.dark} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              {/* Core wire color */}
              <path d={d} fill="none" stroke={wire.core} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {/* Specular highlight */}
              <path d={d} fill="none" stroke={wire.light} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
              {/* Live animated data electron pulses */}
              <path
                d={d}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="5 15"
                className={styles.wireFlow}
                opacity={0.9}
              />

              {/* Large, Clear Schematic Pin Badge on horizontal rail */}
              <g transform={`translate(${chipX}, ${ry - 8})`}>
                <rect x={0} y={0} width={54} height={16} rx={4} fill={wire.core} stroke="#FFFFFF" strokeWidth={1.2} />
                <text x={27} y={11.5} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#FFFFFF">
                  {wire.name}
                </text>
              </g>

              {/* Source pin junction dot */}
              <circle cx={startX} cy={py} r={3.5} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
              {/* Destination pin junction dot */}
              <circle cx={tx} cy={targetY} r={3.5} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
            </g>
          );
        })}
      </g>
    );
  };

  // Render Spacious Direct Schematic Wires: Board Port -> Servo Module
  const renderServoSchematicWires = (portId: string) => {
    const colIdx = Number(portId.slice(1)) - 1;
    const startX = boardOffsetX + PWM_COL_X[colIdx];
    // Y coordinates of PWM, 5V, GND on board
    const pinYOffsets = [
      boardOffsetY + 222 + 0 * 13.5 + 6.5,
      boardOffsetY + 222 + 1 * 13.5 + 6.5,
      boardOffsetY + 222 + 2 * 13.5 + 6.5,
    ];
    // Spacious non-overlapping lowered horizontal routing rails (25px gaps)
    const loweredYRails = [395, 420, 445];
    const turnColumnsX = [620, 645, 670];
    const targetPinsY = [295, 335, 375]; // Y inputs on Servo module (40px pitch)
    const targetX = 700;

    return (
      <g key={`schematic-servo-wires-${portId}`}>
        {WIRE_PWM.map((wire, i) => {
          const py = pinYOffsets[i];
          const ry = loweredYRails[i];
          const ty = targetPinsY[i];
          const turnX = turnColumnsX[i];
          const chipX = 430 + i * 62;
          // Orthogonal path with smooth 8px fillets
          const d = `M ${startX} ${py} V ${ry - 8} Q ${startX} ${ry} ${startX + 8} ${ry} H ${turnX - 8} Q ${turnX} ${ry} ${turnX} ${ry - 8} V ${ty + 8} Q ${turnX} ${ty} ${turnX + 8} ${ty} H ${targetX}`;

          return (
            <g key={`servo-wire-${i}`}>
              {/* Soft Drop shadow */}
              <path d={d} fill="none" stroke="rgba(15,23,42,0.18)" strokeWidth={5} transform="translate(1, 3)" />
              {/* Dark insulation border */}
              <path d={d} fill="none" stroke={wire.dark} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              {/* Core wire color */}
              <path d={d} fill="none" stroke={wire.core} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {/* Specular highlight */}
              <path d={d} fill="none" stroke={wire.light} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
              {/* Live animated data pulse */}
              <path
                d={d}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="5 15"
                className={spinning ? styles.wireFlowFast : styles.wireFlow}
                opacity={0.9}
              />

              {/* Large, Clear Schematic Pin Badge */}
              <g transform={`translate(${chipX}, ${ry - 8})`}>
                <rect x={0} y={0} width={58} height={16} rx={4} fill={wire.core} stroke="#FFFFFF" strokeWidth={1.2} />
                <text x={29} y={11.5} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#FFFFFF">
                  {wire.name}
                </text>
              </g>

              {/* Source pin junction dot */}
              <circle cx={startX} cy={py} r={3.5} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
              {/* Destination pin junction dot */}
              <circle cx={targetX} cy={ty} r={3.5} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg
      viewBox={hasModules ? '0 0 960 480' : '0 0 420 340'}
      role="img"
      aria-label="Skema Rangkaian Interaktif Papan Robotku Controller V3"
      style={{ width: '100%', height: 'auto', display: 'block', transition: 'viewBox 0.3s ease' }}
    >
      <defs>
        {/* CAD Blueprint Schematic Grid Pattern */}
        <pattern id="schemGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.75" />
        </pattern>
        <linearGradient id="pcbGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.pcbTop} />
          <stop offset="100%" stopColor={C.pcbBot} />
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.shieldGradTop} />
          <stop offset="50%" stopColor="#C2C7D0" />
          <stop offset="100%" stopColor={C.shieldGradBot} />
        </linearGradient>
        <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.casingLight} />
          <stop offset="20%" stopColor={C.casing} />
          <stop offset="100%" stopColor={C.casingDark} />
        </linearGradient>
        <radialGradient id="ledGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={led ?? '#FFFFFF'} stopOpacity={led ? 0.95 : 0} />
          <stop offset="50%" stopColor={led ?? '#FFFFFF'} stopOpacity={led ? 0.45 : 0} />
          <stop offset="100%" stopColor={led ?? '#FFFFFF'} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="screwGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor={C.screwHead} />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>
      </defs>

      {/* Blueprint Grid Background when schematic mode is active */}
      {hasModules && <rect width="100%" height="100%" fill="url(#schemGrid)" rx={12} />}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: CONTROLLER BOARD V3 (LEFT SIDE)
          ═══════════════════════════════════════════════════════════════ */}
      <g transform={`translate(${boardOffsetX}, ${boardOffsetY})`}>
        {/* Toska Case */}
        <rect x={2} y={2} width={386} height={296} rx={18} fill="url(#caseGrad)" />
        {[55, 115, 235, 295].map((nx) => (
          <g key={`notch-${nx}`}>
            <rect x={nx} y={0} width={22} height={6} rx={2} fill="#0F172A" opacity={0.25} />
            <rect x={nx} y={294} width={22} height={6} rx={2} fill="#0F172A" opacity={0.25} />
          </g>
        ))}

        {/* Navy PCB */}
        <rect x={14} y={14} width={362} height={272} rx={8} fill="url(#pcbGrad)" stroke="#091A36" strokeWidth={1.5} />

        {/* Copper Traces */}
        <g stroke={C.copperTrace} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 50 48 L 50 85 L 115 85" />
          <path d="M 68 55 L 68 75 L 115 75" />
          <path d="M 115 110 L 140 110 L 140 96 L 150 96" />
          <path d="M 115 130 L 145 130" />
          <path d="M 115 150 L 145 150" />
          <path d="M 115 165 L 150 165 L 150 185 L 165 185" />
          <path d="M 50 214 L 50 190 L 115 190" />
          <path d="M 215 125 L 290 125 L 290 65 L 300 65" />
        </g>

        {/* Solder Vias */}
        {[
          [135, 75],
          [145, 96],
          [142, 140],
          [205, 75],
          [280, 85],
          [295, 135],
        ].map(([vx, vy], i) => (
          <circle key={`via-${i}`} cx={vx} cy={vy} r={1.6} fill="#E2E8F0" stroke="#C4A853" strokeWidth={0.8} />
        ))}

        {/* 4 Screws */}
        {[
          [26, 26],
          [364, 26],
          [26, 274],
          [364, 274],
        ].map(([cx, cy], i) => (
          <g key={`screw-${i}`}>
            <circle cx={cx} cy={cy} r={7} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
            <circle cx={cx} cy={cy} r={5} fill="url(#screwGrad)" />
            <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={C.screwSlot} strokeWidth={1.2} strokeLinecap="round" />
            <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke={C.screwSlot} strokeWidth={1.2} strokeLinecap="round" />
          </g>
        ))}

        {/* ESP-32 Module */}
        <rect x={0} y={108} width={18} height={54} rx={2} fill={C.antennaPcb} />
        <path
          d="M 4 114 H 14 V 120 H 4 V 126 H 14 V 132 H 4 V 138 H 14 V 144 H 4 V 150 H 14"
          stroke={C.antennaCopper}
          strokeWidth={1.2}
          fill="none"
        />
        <rect x={18} y={96} width={92} height={78} rx={5} fill="url(#shieldGrad)" stroke="#7A808C" strokeWidth={1} />
        <text x={64} y={120} textAnchor="middle" fontSize={11.5} fontWeight={900} fill="#374151">
          ESP-32
        </text>
        <path d="M 56 128 A 10 10 0 0 1 72 128 M 59 131 A 6 6 0 0 1 69 131" fill="none" stroke="#4B5563" strokeWidth={1.2} />
        <circle cx={64} cy={134} r={1} fill="#4B5563" />
        <text x={64} y={148} textAnchor="middle" fontSize={5.5} fontWeight={700} fill="#4B5563">
          ISM 2.4G 802.11 b/g/n
        </text>
        <text x={64} y={158} textAnchor="middle" fontSize={6} fontWeight={800} fill="#374151">
          FC CE ROHS
        </text>

        {/* BOOT / RESET */}
        <rect x={24} y={44} width={18} height={14} rx={2.5} fill="#0F172A" stroke="#334155" strokeWidth={0.8} />
        <rect x={27} y={47} width={12} height={8} rx={1.5} fill="#E2E8F0" />
        <text x={33} y={40} textAnchor="middle" fontSize={6} fontWeight={800} fill={C.silkDim}>
          BOOT
        </text>
        <rect x={24} y={214} width={18} height={16} rx={2.5} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={1} />
        <circle cx={33} cy={222} r={4.5} fill="#FFFFFF" stroke="#64748B" strokeWidth={0.8} />
        <text x={33} y={241} textAnchor="middle" fontSize={6} fontWeight={800} fill={C.silkDim}>
          RESET
        </text>

        {/* LED1 */}
        <rect x={140} y={94} width={8} height={5} rx={1} fill="#1E293B" stroke="#475569" strokeWidth={0.5} />
        <rect
          x={142}
          y={95}
          width={4}
          height={3}
          rx={0.5}
          className={linkState === 'ble' ? styles.bleBlink : undefined}
          fill={linkState === 'usb' ? '#22C55E' : linkState === 'ble' ? '#3B82F6' : '#64748B'}
        />
        <text x={152} y={99} fontSize={6} fontWeight={800} fill={C.silkDim}>
          LED1
        </text>

        {/* 5mm RGB LED */}
        {led && <circle cx={150} cy={128} r={28} fill="url(#ledGlow)" />}
        <circle cx={150} cy={128} r={10} fill={led ? led : 'rgba(215, 225, 240, 0.45)'} stroke="#CBD5E1" strokeWidth={1.2} />
        <path d="M 147 125 L 149 130 H 153 L 155 125 Z" fill="#94A3B8" opacity={0.7} />
        <circle cx={147} cy={124} r={2.8} fill="#FFFFFF" opacity={0.85} />
        <text x={150} y={148} textAnchor="middle" fontSize={6.5} fontWeight={800} fill={C.silkDim}>
          RGB
        </text>

        {/* Buzzer */}
        {buzzerActive && (
          <g fill="none" stroke="#EC2D8F" strokeWidth={2}>
            <circle cx={162} cy={188} r={6} className={styles.wave} />
            <circle cx={162} cy={188} r={6} className={`${styles.wave} ${styles.wave2}`} />
          </g>
        )}
        <circle cx={162} cy={188} r={22} fill={C.buzzerBody} stroke="#27272A" strokeWidth={1.5} />
        <circle cx={162} cy={188} r={15} fill="#1F1F23" />
        <circle cx={162} cy={188} r={3} fill={C.buzzerCenter} />
        <text x={178} y={174} fontSize={8} fontWeight={900} fill="#A1A1AA">
          +
        </text>

        {/* ROBOTKU SCHOOL Silkscreen */}
        <g transform="translate(195, 84)">
          <rect x={0} y={4} width={14} height={12} rx={3} fill="none" stroke={C.silk} strokeWidth={1.2} />
          <line x1={7} y1={0} x2={7} y2={4} stroke={C.silk} strokeWidth={1.2} />
          <circle cx={7} cy={0} r={1} fill={C.silk} />
          <circle cx={4.5} cy={9.5} r={1.2} fill={C.silk} />
          <circle cx={9.5} cy={9.5} r={1.2} fill={C.silk} />
          <text x={18} y={13} fontSize={10} fontWeight={900} fill={C.silk}>
            ROBOTKU
          </text>
          <text x={18} y={22} fontSize={7} fontWeight={800} fill={C.silkDim}>
            SCHOOL
          </text>
        </g>

        {/* Purple USB */}
        <rect x={294} y={116} width={54} height={44} rx={4} fill={C.usbPurple} stroke={C.usbPurpleEdge} strokeWidth={1} />
        {[122, 130, 138, 146].map((sy, i) => (
          <circle key={`usb-pad-${i}`} cx={303} cy={sy} r={2} fill="#E2E8F0" />
        ))}
        <rect x={344} y={124} width={22} height={28} rx={3} fill={C.usbMetal} stroke="#64748B" strokeWidth={1.5} />

        {/* CH340C */}
        <rect x={288} y={180} width={40} height={20} rx={2} fill="#09090B" stroke="#27272A" strokeWidth={0.8} />
        <text x={308} y={193} textAnchor="middle" fontSize={6} fontWeight={700} fill="#A1A1AA">
          CH340C
        </text>

        {/* Silkscreen Pin Row Labels */}
        <g fontSize={6.5} fontWeight={800} fill={C.silkDim} textAnchor="end">
          <text x={148} y={45}>GND</text>
          <text x={148} y={59}>VCC</text>
          <text x={148} y={72}>SCL</text>
          <text x={148} y={86}>SDA</text>
        </g>
        <g fontSize={6.5} fontWeight={800} fill={C.silkDim} textAnchor="end">
          <text x={148} y={232}>PWM</text>
          <text x={148} y={246}>5V</text>
          <text x={148} y={259}>GND</text>
        </g>

        {/* Headers I2C & PWM */}
        {[0, 1, 2, 3, 4].map((i) => renderHeaderColumn('i2c', i))}
        {[0, 1, 2, 3, 4].map((i) => renderHeaderColumn('pwm', i))}
      </g>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: DIRECT SCHEMATIC WIRES (SPACIOUS FRITZING BUS)
          ═══════════════════════════════════════════════════════════════ */}
      {showWires && attachedOledPort && renderOledSchematicWires(attachedOledPort.id)}
      {showWires && attachedServoPort && renderServoSchematicWires(attachedServoPort.id)}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: ATTACHED MODULES (RIGHT SIDE)
          ═══════════════════════════════════════════════════════════════ */}
      {hasModules && (
        <g>
          {/* OLED 0.96" Module Top Right */}
          {attachedOledPort && (
            <g transform="translate(700, 30)">
              {/* Mint Enclosure */}
              <rect x={0} y={0} width={230} height={160} rx={16} fill="url(#caseGrad)" />
              <rect x={8} y={8} width={214} height={144} rx={8} fill={C.oledPcb} stroke="#0B254E" strokeWidth={1.5} />
              {/* Screws */}
              <circle cx={20} cy={20} r={5.5} fill="#64748B" />
              <circle cx={210} cy={20} r={5.5} fill="url(#screwGrad)" />
              <circle cx={20} cy={140} r={5.5} fill="url(#screwGrad)" />
              <circle cx={210} cy={140} r={5.5} fill="#64748B" />

              {/* Pin Header with 35px spacing matching wire destinations */}
              {[45, 80, 115, 150].map((px) => (
                <g key={`pad-${px}`}>
                  <circle cx={px} cy={30} r={4} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={1} />
                  <circle cx={px} cy={30} r={1.8} fill="#64748B" />
                </g>
              ))}
              <text x={28} y={23} fontSize={7.5} fontWeight={900} fill="#FFFFFF">1</text>
              <text x={45} y={22} textAnchor="middle" fontSize={7} fontWeight={800} fill="#FFFFFF">GND</text>
              <text x={80} y={22} textAnchor="middle" fontSize={7} fontWeight={800} fill="#FFFFFF">VDD</text>
              <text x={115} y={22} textAnchor="middle" fontSize={7} fontWeight={800} fill="#FFFFFF">SCK</text>
              <text x={150} y={22} textAnchor="middle" fontSize={7} fontWeight={800} fill="#FFFFFF">SDA</text>
              <text x={168} y={23} fontSize={7.5} fontWeight={900} fill="#FFFFFF">4</text>

              {/* OLED Screen Glass */}
              <rect x={18} y={42} width={194} height={98} rx={4} fill={C.oledScreen} stroke="#090F1A" strokeWidth={1.5} />

              {/* Live OLED Display Content */}
              <svg x={22} y={46} width={186} height={90} viewBox="0 0 128 64">
                {bmpUrl ? (
                  <image href={bmpUrl} x={0} y={0} width={128} height={64} style={{ imageRendering: 'pixelated' }} />
                ) : oledMatrix ? (
                  Array.from({ length: 25 }, (_, i) => (
                    <rect
                      key={i}
                      x={24 + (i % 5) * 16}
                      y={2 + Math.floor(i / 5) * 12}
                      width={13}
                      height={10}
                      rx={2}
                      fill={oledMatrix[i] ? C.oledPixelOn : C.oledPixelOff}
                    />
                  ))
                ) : oledShape ? (
                  <circle cx={64} cy={32} r={18} fill="none" stroke={C.oledPixelOn} strokeWidth={3} />
                ) : (
                  <text
                    x={4}
                    y={32}
                    fontSize={18}
                    fontFamily="monospace"
                    fontWeight={700}
                    fill={C.oledPixelOn}
                    className={styles.oledMarquee}
                  >
                    {oledText || 'Robotku OLED'}
                  </text>
                )}
              </svg>
            </g>
          )}

          {/* SG90 Servo Module Bottom Right */}
          {attachedServoPort && (
            <g transform={attachedOledPort ? 'translate(700, 240)' : 'translate(700, 120)'}>
              {/* Mint Mount */}
              <rect x={0} y={0} width={230} height={190} rx={14} fill={C.casing} stroke={C.casingDark} strokeWidth={1.2} />

              {/* Translucent Blue Servo Body */}
              <rect x={40} y={20} width={115} height={150} rx={8} fill={C.servoBody} stroke="#1E40AF" strokeWidth={1.5} />
              <text x={97} y={155} textAnchor="middle" fontSize={9} fontWeight={900} fill="#BFDBFE">
                SG90 9g Micro Servo
              </text>

              {/* Gear Silhouettes inside servo body */}
              <circle cx={97} cy={75} r={32} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={3.5} strokeDasharray="4 4" />
              <circle cx={72} cy={88} r={18} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2.5} strokeDasharray="3 3" />

              {/* Terminal Connector Block on Left matching wire targets */}
              {[
                { y: 55, label: 'PWM', color: '#F59E0B' },
                { y: 95, label: '5V', color: '#DC2626' },
                { y: 135, label: 'GND', color: '#78350F' },
              ].map((pin, i) => (
                <g key={`servo-pin-${i}`}>
                  <rect x={0} y={pin.y - 12} width={36} height={24} rx={3} fill="#18181B" stroke="#27272A" strokeWidth={0.8} />
                  <rect x={4} y={pin.y - 8} width={14} height={16} rx={2} fill={pin.color} />
                  <text x={22} y={pin.y + 4} fontSize={7} fontWeight={900} fill="#FFFFFF">
                    {pin.label}
                  </text>
                </g>
              ))}

              {/* Spinning 4-Arm Cross Servo Horn */}
              <g className={spinning ? styles.servoHornSpin : undefined} style={hornStyle}>
                <g transform="translate(97, 75)">
                  <rect x={-45} y={-7} width={90} height={14} rx={7} fill={C.servoHorn} stroke="#CBD5E1" strokeWidth={1} />
                  <rect x={-7} y={-45} width={14} height={90} rx={7} fill={C.servoHorn} stroke="#CBD5E1" strokeWidth={1} />
                  <circle cx={0} cy={0} r={11} fill={C.servoHorn} stroke="#CBD5E1" strokeWidth={1} />
                  {[-35, -24, 24, 35].map((d) => (
                    <circle key={`h-${d}`} cx={d} cy={0} r={2} fill="#64748B" />
                  ))}
                  {[-35, -24, 24, 35].map((d) => (
                    <circle key={`v-${d}`} cx={0} cy={d} r={2} fill="#64748B" />
                  ))}
                  <circle cx={0} cy={0} r={4} fill="#94A3B8" />
                </g>
              </g>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}



