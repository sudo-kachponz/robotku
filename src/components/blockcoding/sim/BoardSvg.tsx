// src/components/blockcoding/sim/BoardSvg.tsx
//
// Interactive simulator canvas for the Robotku Makerkit V1.3 PCB.
// The board is drawn 1:1 from the real board photo: white solder mask with black
// silkscreen, sitting in a black hard case. Layout (board-local units, 390x300):
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ ROBOTKU   GND ■■■  AUX ■■  ┊GND   INPUT & OUTPUT      ◯            │
//   │  SCHOOL    5V ■■■      ■■  ┊TRIG  ■■■■ VCC                         │
//   │           PWM ■■■      ■■  ┊ECHO  ■■■■ GND                         │
//   │                1 2 3   5 6 ┊VCC   ■■■■ IN   [RESET]                │
//   │ USB-C   ( BUZZER )  ● 1  LED      ┌────── ESP32-S3 ──────┐          │
//   │ [▣▣]     WIFI ▭     ● 2  RGB      │                      │ ant      │
//   │          BT   ▭     ● 3           └──────────────────────┘          │
//   │  MIC (◎)            ● 4                       TOUCH 1 ▒▒            │
//   │  POWER ●    I2C BUS ■■■■■ SDA     SPEAKER [MAX98357A]  UART         │
//   │ MAKERKIT V1.3       ■■■■■ SCL…                                      │
//   └──────────────────────────────────────────────────────────────────────┘
//
// The 5 simulator PWM ports map to the 5 servo-style headers (1,2,3 + AUX 5,6);
// the 5 I2C ports map to the 5 columns of the I2C BUS header. Attached OLED /
// servo modules are wired with orthogonal schematic wires that leave each header
// through the nearest board edge (servo headers → up, I2C bus → down).

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './SimBoard.module.css';

// ─── Palette (matched to the Makerkit V1.3 photo) ───────────────────────────
const C = {
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
const BW = 390;
const BH = 300;
const PCB = { x: 12, y: 14, w: 366, h: 272 } as const;
const PITCH = 13; // header pitch (row + column)
const CELL = 11; // header socket size

// Servo-style headers (top edge). Rows from the board edge inward, as silkscreened.
const SERVO_ROWS = [
  { pin: 'GND', color: C.hBlack },
  { pin: '5V', color: C.hRed },
  { pin: 'PWM', color: C.hYellow },
] as const;
const SERVO_Y0 = 22;

// I2C BUS header (bottom edge). Rows top→bottom as silkscreened.
const I2C_ROWS = [
  { pin: 'SDA', color: C.hYellow },
  { pin: 'SCL', color: C.hWhite },
  { pin: 'VCC', color: C.hRed },
  { pin: 'GND', color: C.hBlack },
] as const;
const I2C_Y0 = 231;

/**
 * Simulator PWM port → physical header column, left to right: P1–P3 are the
 * servo headers 1–3, P4/P5 are the AUX headers 5/6. The silkscreen numbers are
 * the board's own; change this map once the Makerkit pin map is confirmed.
 */
const PWM_HEADER: Record<string, { x: number; silk: string }> = {
  P1: { x: 180, silk: '1' },
  P2: { x: 193, silk: '2' },
  P3: { x: 206, silk: '3' },
  P4: { x: 230, silk: '5' },
  P5: { x: 243, silk: '6' },
};
const I2C_HEADER_X: Record<string, number> = { I1: 140, I2: 153, I3: 166, I4: 179, I5: 192 };

// Column X coordinates (board-local), kept as exports for callers/tests.
export const PWM_COL_X = ['P1', 'P2', 'P3', 'P4', 'P5'].map((id) => PWM_HEADER[id].x);
export const I2C_COL_X = ['I1', 'I2', 'I3', 'I4', 'I5'].map((id) => I2C_HEADER_X[id]);

// Color-coded schematic wire definitions (order = OLED / servo terminal order)
const WIRE_I2C = [
  { pin: 'GND', name: 'GND (0V)', core: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
  { pin: 'VCC', name: 'VDD (3.3V)', core: '#16A34A', light: '#4ADE80', dark: '#15803D' },
  { pin: 'SCL', name: 'SCK (Clock)', core: '#EAB308', light: '#FDE047', dark: '#CA8A04' },
  { pin: 'SDA', name: 'SDA (Data)', core: '#EA580C', light: '#FB923C', dark: '#C2410C' },
];

const WIRE_PWM = [
  { pin: 'PWM', name: 'PWM (Sinyal)', core: '#F59E0B', light: '#FCD34D', dark: '#D97706' },
  { pin: '5V', name: '5V (Daya)', core: '#DC2626', light: '#F87171', dark: '#B91C1C' },
  { pin: 'GND', name: 'GND (0V)', core: '#78350F', light: '#92400E', dark: '#451A03' },
];

export interface PortVisual {
  id: string; // 'P1'..'P5' | 'I1'..'I5'
  kind: 'pwm' | 'i2c';
  active?: boolean;
  module?: 'servo' | 'oled' | null;
  pulsing?: boolean;
}

interface Props {
  rgb: { r: number; g: number; b: number } | null;
  /** 4 WS2812B pixels (CSS colors). Falls back to `rgb` on all 4 when unlit. */
  neoPixels?: string[];
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
  servoSpeeds?: Record<string, number> | number[];
  positions?: Record<string, { x: number; y: number }>;
  onPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
}

export interface PlacedModule {
  id: string;
  kind: 'oled' | 'servo';
  portId: string;
  x: number;
  y: number;
  col: number;
  row: number;
}

type Pt = [number, number];

/** Orthogonal polyline with rounded corners (any direction). */
function roundedPath(raw: Pt[], radius = 7): string {
  // drop duplicate and collinear points
  const pts: Pt[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = last;
      const collinear = (a[0] === b[0] && b[0] === p[0]) || (a[1] === b[1] && b[1] === p[1]);
      if (collinear) pts.pop();
    }
    pts.push(p);
  }
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / (inLen || 1)) * r;
    const ay = cy - ((cy - py) / (inLen || 1)) * r;
    const bx = cx + ((nx - cx) / (outLen || 1)) * r;
    const by = cy + ((ny - cy) / (outLen || 1)) * r;
    d += ` L ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
  }
  const end = pts[pts.length - 1];
  d += ` L ${end[0]} ${end[1]}`;
  return d;
}

const isLit = (col?: string | null) => !!col && col !== 'rgb(0, 0, 0)' && col !== '#000000' && col !== 'black';

export default function BoardSvg({
  rgb,
  neoPixels = [],
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
  servoSpeeds,
  positions,
  onPositionsChange,
}: Props) {
  const led = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null;
  const byId = (id: string) => ports.find((p) => p.id === id);

  // The 4 WS2812B pixels: a driven pixel wins, otherwise the manual/global RGB.
  const pixelColors = [0, 1, 2, 3].map((i) => {
    const px = neoPixels[i];
    if (isLit(px)) return px as string;
    return isLit(led) ? (led as string) : null;
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>(positions || {});
  const [dragging, setDragging] = useState<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    if (positions) {
      setLocalPositions(positions);
    }
  }, [positions]);

  // Detect ALL attached ports (multiple OLEDs and multiple Servos)
  const attachedOledPorts = useMemo(
    () => ports.filter((p) => p.kind === 'i2c' && p.module === 'oled'),
    [ports]
  );
  const attachedServoPorts = useMemo(
    () => ports.filter((p) => p.kind === 'pwm' && p.module === 'servo'),
    [ports]
  );
  const totalModules = attachedOledPorts.length + attachedServoPorts.length;
  const hasModules = totalModules > 0;

  const getModulePos = (id: string, defaultX: number, defaultY: number) => {
    const pos = positions?.[id] ?? localPositions[id];
    return pos ? pos : { x: defaultX, y: defaultY };
  };

  const defaultBoardX = hasModules ? 30 : 15;
  const defaultBoardY = hasModules ? 80 : 20;
  const boardPos = getModulePos('board', defaultBoardX, defaultBoardY);
  const boardOffsetX = boardPos.x;
  const boardOffsetY = boardPos.y;

  // Grid placement for all attached modules on the right with custom positions
  const placedModules = useMemo(() => {
    const list: PlacedModule[] = [];
    let index = 0;

    attachedOledPorts.forEach((p) => {
      const col = Math.floor(index / 2);
      const row = index % 2;
      const defX = 690 + col * 265;
      const defY = row === 0 ? 25 : 245;
      const pos = getModulePos(`oled-${p.id}`, defX, defY);
      list.push({ id: `oled-${p.id}`, kind: 'oled', portId: p.id, x: pos.x, y: pos.y, col, row });
      index++;
    });

    attachedServoPorts.forEach((p) => {
      const col = Math.floor(index / 2);
      const row = index % 2;
      const defX = 690 + col * 265;
      const defY = row === 0 ? 25 : 245;
      const pos = getModulePos(`servo-${p.id}`, defX, defY);
      list.push({ id: `servo-${p.id}`, kind: 'servo', portId: p.id, x: pos.x, y: pos.y, col, row });
      index++;
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedOledPorts, attachedServoPorts, positions, localPositions]);

  // Dynamically compute canvas dimensions based on board and module positions
  const { svgWidth, svgHeight } = useMemo(() => {
    if (!hasModules) return { svgWidth: 420, svgHeight: 340 };
    let maxX = boardOffsetX + BW;
    let maxY = boardOffsetY + BH + 50; // room for wires leaving the I2C bus downward
    placedModules.forEach((m) => {
      maxX = Math.max(maxX, m.x + 250);
      maxY = Math.max(maxY, m.y + 210);
    });
    return {
      svgWidth: Math.max(960, maxX + 40),
      svgHeight: Math.max(520, maxY + 40),
    };
  }, [hasModules, boardOffsetX, boardOffsetY, placedModules]);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest?.(`.${styles.portClick}`)) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {}

    const current =
      id === 'board'
        ? { x: boardOffsetX, y: boardOffsetY }
        : placedModules.find((m) => m.id === id) || { x: 0, y: 0 };

    setDragging({
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;
    const dx = (e.clientX - dragging.startX) * scaleX;
    const dy = (e.clientY - dragging.startY) * scaleY;
    const nextX = Math.max(10, Math.round(dragging.origX + dx));
    const nextY = Math.max(10, Math.round(dragging.origY + dy));

    const updated = {
      ...(positions || localPositions),
      [dragging.id]: { x: nextX, y: nextY },
    };
    setLocalPositions(updated);
    onPositionsChange?.(updated);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      try {
        (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      } catch {}
      setDragging(null);
    }
  };

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

  // ─── Pin anchors (canvas coordinates) ─────────────────────────────────────
  const pwmAnchor = (portId: string, pin: string): Pt => {
    const row = SERVO_ROWS.findIndex((r) => r.pin === pin);
    return [boardOffsetX + PWM_HEADER[portId].x, boardOffsetY + SERVO_Y0 + row * PITCH + CELL / 2];
  };
  const i2cAnchor = (portId: string, pin: string): Pt => {
    const row = I2C_ROWS.findIndex((r) => r.pin === pin);
    return [boardOffsetX + I2C_HEADER_X[portId], boardOffsetY + I2C_Y0 + row * PITCH + CELL / 2];
  };

  // ─── One header socket cell ───────────────────────────────────────────────
  const socket = (cx: number, top: number, color: string, key: string | number) => {
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

  // ─── Interactive port header column (servo headers + I2C bus) ─────────────
  const renderPortColumn = (id: string) => {
    const kind = id[0] === 'P' ? 'pwm' : 'i2c';
    const p = byId(id);
    const x = kind === 'pwm' ? PWM_HEADER[id].x : I2C_HEADER_X[id];
    const rows = kind === 'pwm' ? SERVO_ROWS : I2C_ROWS;
    const y0 = kind === 'pwm' ? SERVO_Y0 : I2C_Y0;
    const blockH = (rows.length - 1) * PITCH + CELL;

    return (
      <g
        key={id}
        className={styles.portClick}
        role="button"
        tabIndex={0}
        aria-label={`Port ${kind === 'pwm' ? 'PWM' : 'I2C'} ${id}${p?.module ? ` (${p.module})` : ''}`}
        onClick={() => onPortClick?.(id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPortClick?.(id)}
      >
        <rect
          x={x - 7.5}
          y={y0 - 2}
          width={15}
          height={blockH + 4}
          rx={3}
          fill={p?.active ? 'rgba(129,133,244,0.35)' : 'transparent'}
          stroke={p?.active ? C.active : p?.pulsing ? '#F59E0B' : 'transparent'}
          strokeWidth={1.4}
        >
          {p?.pulsing && <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />}
        </rect>
        {rows.map((r, i) => socket(x, y0 + i * PITCH, r.color, i))}
      </g>
    );
  };

  // ─── Port ID chips on the black case rim (drawn above wires) ──────────────
  const renderPortChips = () => (
    <g>
      {ports.map((p) => {
        const isPwm = p.kind === 'pwm';
        const lx = isPwm ? PWM_HEADER[p.id]?.x : I2C_HEADER_X[p.id];
        if (lx == null) return null;
        const cx = boardOffsetX + lx;
        const cy = boardOffsetY + (isPwm ? 6.5 : BH - 6.5);
        const modColor = p.module === 'oled' ? '#38BDF8' : p.module === 'servo' ? '#F59E0B' : null;
        return (
          <g
            key={`chip-${p.id}`}
            fontFamily="'DejaVu Sans', 'Segoe UI', system-ui, sans-serif"
            className={styles.portClick}
            onClick={() => onPortClick?.(p.id)}
            aria-hidden="true"
          >
            <rect
              x={cx - 6.5}
              y={cy - 5}
              width={13}
              height={10}
              rx={3}
              fill={modColor ?? (p.active ? C.active : '#27272A')}
              stroke={modColor ? '#FFFFFF' : '#52525B'}
              strokeWidth={0.7}
            />
            <text x={cx} y={cy + 2.4} textAnchor="middle" fontSize={6.2} fontWeight={800}
                  fill={modColor ? '#0B0B0D' : C.caseText}>
              {p.id}
            </text>
          </g>
        );
      })}
    </g>
  );

  // ─── Schematic wire bundle helpers ─────────────────────────────────────────
  const wireStack = (d: string, wire: { core: string; light: string; dark: string }, fast: boolean, key: string) => (
    <g key={key}>
      <path d={d} fill="none" stroke="rgba(15,23,42,0.18)" strokeWidth={5} transform="translate(1, 3)" />
      <path d={d} fill="none" stroke={wire.dark} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={wire.core} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={wire.light} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <path
        d={d}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={fast ? '5 15' : '4 12'}
        className={fast ? styles.wireFlowFast : styles.wireFlow}
        opacity={0.85}
      />
    </g>
  );

  const pinBadge = (x: number, y: number, wire: { pin: string; core: string }) => (
    <g transform={`translate(${x - 23}, ${y - 8})`}>
      <rect x={0} y={0} width={46} height={15} rx={3} fill={wire.core} stroke="#FFFFFF" strokeWidth={1.2} />
      <text x={23} y={10.5} textAnchor="middle" fontSize={6.5} fontWeight={900} fill="#FFFFFF">
        {wire.pin}
      </text>
    </g>
  );

  // I2C BUS (bottom edge) → OLED module: exit down, run right under the board,
  // climb beside the module and drop onto its top pin row.
  const renderOledSchematicWires = (placed: PlacedModule) => {
    const portId = placed.portId;
    const colIdx = Number(portId.slice(1)) - 1;
    const targetPinsX = [placed.x + 45, placed.x + 80, placed.x + 115, placed.x + 150];
    const targetY = placed.y + 30;
    const boardBottom = boardOffsetY + BH;

    return (
      <g key={`schematic-oled-wires-${portId}`}>
        {WIRE_I2C.map((wire, i) => {
          const [sx, sy] = i2cAnchor(portId, wire.pin);
          const tx = targetPinsX[i];
          let d: string;
          let badge: Pt;
          if (placed.x > boardOffsetX + BW - 10) {
            const ry = boardBottom + 10 + colIdx * 7 + i * 3;
            const lx = placed.x - 16 - (3 - i) * 6;
            const topY = Math.max(4, placed.y - 10 - i * 4);
            d = roundedPath([[sx, sy], [sx, ry], [lx, ry], [lx, topY], [tx, topY], [tx, targetY]]);
            badge = [(sx + lx) / 2 + (i - 1.5) * 52, ry];
          } else {
            const midY = Math.max(sy, targetY) + 40 + i * 8;
            d = `M ${sx} ${sy} C ${sx} ${midY} ${tx} ${midY} ${tx} ${targetY}`;
            badge = [(sx + tx) / 2, midY - 10];
          }
          return (
            <g key={`oled-wire-${portId}-${i}`}>
              {wireStack(d, wire, false, `ow-${i}`)}
              {pinBadge(badge[0], badge[1], wire)}
              <circle cx={sx} cy={sy} r={3.2} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
              <circle cx={tx} cy={targetY} r={3.5} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
            </g>
          );
        })}
      </g>
    );
  };

  // Servo headers (top edge) → servo module: exit up over the case rim, run
  // right above the board, drop beside the module and enter its terminal block.
  const renderServoSchematicWires = (placed: PlacedModule) => {
    const portId = placed.portId;
    const colIdx = Number(portId.slice(1)) - 1;
    const speed =
      (servoSpeeds && typeof servoSpeeds === 'object' && !Array.isArray(servoSpeeds)
        ? servoSpeeds[portId]
        : Array.isArray(servoSpeeds)
          ? servoSpeeds[colIdx]
          : servoSpeed) ?? 0;
    const isSpinning = Math.abs(speed) > 2;
    const targetPinsY = [placed.y + 55, placed.y + 95, placed.y + 135];
    const targetX = placed.x;

    return (
      <g key={`schematic-servo-wires-${portId}`}>
        {WIRE_PWM.map((wire, i) => {
          const [sx, sy] = pwmAnchor(portId, wire.pin);
          const ty = targetPinsY[i];
          let d: string;
          let badge: Pt;
          if (placed.x > boardOffsetX + BW - 10) {
            const ry = Math.max(4, boardOffsetY - 12 - colIdx * 7 - i * 3);
            const turnX = placed.x - 30 + i * 8;
            d = roundedPath([[sx, sy], [sx, ry], [turnX, ry], [turnX, ty], [targetX, ty]]);
            badge = [(sx + turnX) / 2 + (i - 1) * 52, ry];
          } else {
            const midY = Math.min(sy, ty) - 60 - i * 10;
            d = `M ${sx} ${sy} C ${sx} ${midY} ${targetX - 60 - i * 10} ${ty} ${targetX} ${ty}`;
            badge = [(sx + targetX) / 2, Math.max(10, midY + 10)];
          }
          return (
            <g key={`servo-wire-${portId}-${i}`}>
              {wireStack(d, wire, isSpinning, `sw-${i}`)}
              {pinBadge(badge[0], badge[1], wire)}
              <circle cx={sx} cy={sy} r={3.2} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
              <circle cx={targetX} cy={ty} r={3.5} fill="#FFFFFF" stroke={wire.core} strokeWidth={1.6} />
            </g>
          );
        })}
      </g>
    );
  };

  // ─── Small silkscreen helpers ─────────────────────────────────────────────
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
  const bleOn = linkState === 'ble';

  return (
    <svg
      ref={svgRef}
      viewBox={hasModules ? `0 0 ${svgWidth} ${svgHeight}` : '0 0 420 340'}
      role="img"
      aria-label="Skema rangkaian interaktif papan Robotku Makerkit V1.3"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: '100%',
        height: 'auto',
        display: 'block',
        touchAction: 'none',
        userSelect: 'none',
        transition: dragging ? 'none' : 'viewBox 0.3s ease',
      }}
    >
      <title>ROBOTKU SCHOOL Makerkit V1.3</title>
      <defs>
        <pattern id="schemGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--line, #E2E8F0)" strokeWidth="0.75" />
        </pattern>
        <linearGradient id="pcbGrad" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={C.pcbTop} />
          <stop offset="100%" stopColor={C.pcbBot} />
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.shieldGradTop} />
          <stop offset="55%" stopColor="#C6CAD1" />
          <stop offset="100%" stopColor={C.shieldGradBot} />
        </linearGradient>
        <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.casingLight} />
          <stop offset="18%" stopColor={C.casing} />
          <stop offset="100%" stopColor={C.casingDark} />
        </linearGradient>
        <radialGradient id="screwGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor={C.screwHead} />
          <stop offset="100%" stopColor="#64748B" />
        </radialGradient>
        <radialGradient id="buzzerGrad" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#2A2A2E" />
          <stop offset="100%" stopColor="#0B0B0C" />
        </radialGradient>
        <pattern id="touchHatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="3" fill={C.touchPad} />
          <line x1="0" y1="0" x2="0" y2="3" stroke="#AEB3BA" strokeWidth="1" />
        </pattern>
        <filter id="ledBloom" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="dragShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.25" />
        </filter>
      </defs>

      {hasModules && <rect width="100%" height="100%" fill="url(#schemGrid)" rx={12} />}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: MAKERKIT V1.3 BOARD IN BLACK HARD CASE (DRAGGABLE)
          ═══════════════════════════════════════════════════════════════ */}
      <g
        transform={`translate(${boardOffsetX}, ${boardOffsetY})`}
        className={`${styles.dragItem} ${dragging?.id === 'board' ? styles.dragging : ''}`}
        onPointerDown={(e) => handlePointerDown('board', e)}
        fontFamily={silkFont}
      >
        {/* Black hard case */}
        <rect x={0} y={0} width={BW} height={BH} rx={16} fill="url(#caseGrad)" stroke={C.caseEdge} strokeWidth={1} />
        <rect x={4} y={4} width={BW - 8} height={BH - 8} rx={13} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={2} />

        {/* Drag handle hint on the case rim */}
        <g transform="translate(14, 2)" opacity={0.85}>
          <rect x={0} y={0} width={30} height={10} rx={3} fill="#2A2A2F" stroke="#3F3F46" strokeWidth={0.6} />
          <text x={15} y={7.4} textAnchor="middle" fontSize={6} fontWeight={800} fill="#A1A1AA">
            ⠿ Geser
          </text>
        </g>

        {/* White PCB */}
        <rect x={PCB.x} y={PCB.y} width={PCB.w} height={PCB.h} rx={7} fill="url(#pcbGrad)" stroke={C.pcbEdge} strokeWidth={1} />

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
            <circle cx={cx} cy={cy} r={6} fill="url(#screwGrad)" />
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
        <circle cx={140} cy={96} r={27} fill="url(#buzzerGrad)" stroke="#000" strokeWidth={1} />
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
        <rect x={136} y={130.5} width={9} height={4.5} rx={0.6} fill="#E4E4E7" />
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
        <circle cx={62} cy={253} r={9} fill="#EF4444" opacity={0.45} filter="url(#ledBloom)" />
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
              {col && <circle cx={208} cy={cy} r={15} fill={col} opacity={0.75} filter="url(#ledBloom)" />}
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
          <rect x={264} y={99} width={84} height={76} rx={3} fill="url(#shieldGrad)" stroke="#7A808C" strokeWidth={0.9} />
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
        <rect x={327} y={185} width={41} height={37} rx={6} fill="url(#touchHatch)" stroke="#9CA3AF" strokeWidth={0.8} />
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
            <circle cx={sx} cy={270} r={6.4} fill="url(#screwGrad)" stroke="#475569" strokeWidth={0.6} />
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

        {/* ── Interactive headers: servo 1-3 + AUX 5-6 (PWM), I2C BUS ── */}
        {['P1', 'P2', 'P3', 'P4', 'P5'].map((id) => renderPortColumn(id))}
        {['I1', 'I2', 'I3', 'I4', 'I5'].map((id) => renderPortColumn(id))}
      </g>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: DIRECT SCHEMATIC WIRES
          ═══════════════════════════════════════════════════════════════ */}
      {showWires &&
        placedModules.map((placed) =>
          placed.kind === 'oled' ? renderOledSchematicWires(placed) : renderServoSchematicWires(placed)
        )}

      {/* Port chips sit on the case rim, above any wire */}
      {renderPortChips()}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: ATTACHED MODULES (RIGHT SIDE - DRAGGABLE)
          ═══════════════════════════════════════════════════════════════ */}
      {hasModules && (
        <g>
          {placedModules.map((placed) => {
            if (placed.kind === 'oled') {
              return (
                <g
                  key={placed.id}
                  transform={`translate(${placed.x}, ${placed.y})`}
                  className={`${styles.dragItem} ${dragging?.id === placed.id ? styles.dragging : ''}`}
                  onPointerDown={(e) => handlePointerDown(placed.id, e)}
                >
                  {/* Black hard case */}
                  <rect x={0} y={0} width={230} height={160} rx={16} fill="url(#caseGrad)" stroke={C.caseEdge} strokeWidth={1} />
                  <rect x={8} y={8} width={214} height={144} rx={8} fill={C.oledPcb} stroke="#0B254E" strokeWidth={1.5} />
                  <circle cx={20} cy={20} r={5.5} fill="#64748B" />
                  <circle cx={210} cy={20} r={5.5} fill="url(#screwGrad)" />
                  <circle cx={20} cy={140} r={5.5} fill="url(#screwGrad)" />
                  <circle cx={210} cy={140} r={5.5} fill="#64748B" />

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

                  <rect x={170} y={10} width={48} height={16} rx={4} fill="#0F172A" stroke="#38BDF8" strokeWidth={1} />
                  <text x={194} y={21.5} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#38BDF8">
                    ⠿ {placed.portId}
                  </text>

                  <rect x={18} y={42} width={194} height={98} rx={4} fill={C.oledScreen} stroke="#090F1A" strokeWidth={1.5} />

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
                        {oledText || `Robotku (${placed.portId})`}
                      </text>
                    )}
                  </svg>
                </g>
              );
            }

            // SG90 servo in its black wheel-servo casing
            const colIdx = Number(placed.portId.slice(1)) - 1;
            const currentSpeed =
              (servoSpeeds && typeof servoSpeeds === 'object' && !Array.isArray(servoSpeeds)
                ? servoSpeeds[placed.portId]
                : Array.isArray(servoSpeeds)
                  ? servoSpeeds[colIdx]
                  : servoSpeed) ?? 0;
            const isPortSpinning = Math.abs(currentSpeed) > 2;
            const portDur = isPortSpinning ? `${Math.max(0.35, 1.8 - Math.abs(currentSpeed) / 70).toFixed(2)}s` : undefined;
            const currentHornStyle: React.CSSProperties = isPortSpinning
              ? ({ ['--spin-dur' as string]: portDur, animationDirection: currentSpeed < 0 ? 'reverse' : 'normal' } as React.CSSProperties)
              : { transform: 'rotate(90deg)', transformOrigin: 'center', transition: 'transform 0.2s ease' };

            return (
              <g
                key={placed.id}
                transform={`translate(${placed.x}, ${placed.y})`}
                className={`${styles.dragItem} ${dragging?.id === placed.id ? styles.dragging : ''}`}
                onPointerDown={(e) => handlePointerDown(placed.id, e)}
              >
                {/* Black servo casing */}
                <rect x={0} y={0} width={230} height={190} rx={14} fill="url(#caseGrad)" stroke={C.caseEdge} strokeWidth={1} />
                {[[14, 14], [216, 14], [14, 176], [216, 176]].map(([hx, hy], i) => (
                  <circle key={`sh-${i}`} cx={hx} cy={hy} r={3.4} fill="#000" stroke="#3F3F46" strokeWidth={0.8} />
                ))}

                <g transform="translate(170, 10)">
                  <rect x={0} y={0} width={48} height={16} rx={4} fill="#0F172A" stroke="#F59E0B" strokeWidth={1} />
                  <text x={24} y={11.5} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#F59E0B">
                    ⠿ {placed.portId}
                  </text>
                </g>

                <rect x={40} y={20} width={115} height={150} rx={8} fill={C.servoBody} stroke="#1E40AF" strokeWidth={1.5} />
                <text x={97} y={155} textAnchor="middle" fontSize={9} fontWeight={900} fill="#BFDBFE">
                  SG90 9g ({placed.portId})
                </text>

                <circle cx={97} cy={75} r={32} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={3.5} strokeDasharray="4 4" />
                <circle cx={72} cy={88} r={18} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2.5} strokeDasharray="3 3" />

                {[
                  { y: 55, label: 'PWM', color: '#F59E0B' },
                  { y: 95, label: '5V', color: '#DC2626' },
                  { y: 135, label: 'GND', color: '#78350F' },
                ].map((pin, i) => (
                  <g key={`servo-pin-${placed.id}-${i}`}>
                    <rect x={0} y={pin.y - 12} width={36} height={24} rx={3} fill="#18181B" stroke="#3F3F46" strokeWidth={0.8} />
                    <rect x={4} y={pin.y - 8} width={14} height={16} rx={2} fill={pin.color} />
                    <text x={22} y={pin.y + 4} fontSize={7} fontWeight={900} fill="#FFFFFF">
                      {pin.label}
                    </text>
                  </g>
                ))}

                <g className={isPortSpinning ? styles.servoHornSpin : undefined} style={currentHornStyle}>
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
            );
          })}
        </g>
      )}
    </svg>
  );
}
