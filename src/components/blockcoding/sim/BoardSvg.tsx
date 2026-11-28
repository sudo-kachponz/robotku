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
import MakerkitBoardArt, {
  C,
  BW,
  BH,
  PITCH,
  CELL,
  SERVO_ROWS,
  SERVO_Y0,
  I2C_ROWS,
  I2C_Y0,
  PWM_HEADER,
  I2C_HEADER_X,
  socket,
} from './MakerkitBoardArt';


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

  const silkFont = "'DejaVu Sans', 'Segoe UI', system-ui, sans-serif";
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
        {/* Board art (case, PCB, parts) is shared with the Base Robot + robot sprite. */}
        <MakerkitBoardArt pixelColors={pixelColors} buzzerActive={buzzerActive} bleOn={bleOn} staticHeaders={false} />

        {/* Drag handle hint on the case rim */}
        <g transform="translate(14, 2)" opacity={0.85}>
          <rect x={0} y={0} width={30} height={10} rx={3} fill="#2A2A2F" stroke="#3F3F46" strokeWidth={0.6} />
          <text x={15} y={7.4} textAnchor="middle" fontSize={6} fontWeight={800} fill="#A1A1AA">
            ⠿ Geser
          </text>
        </g>

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
