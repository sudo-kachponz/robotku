// src/components/blockcoding/sim/BoardSvg.tsx
//
// Pure-SVG top view of the Robotku Controller V3, matching the board photos
// (4.md). Reacts to existing SimSink state: RGB LED glows, buzzer rings, ports
// highlight, link LED shows USB/BLE. No data/protocol/firmware changes here.

import styles from './SimBoard.module.css';

// ── All spec colors in ONE place so they're easy to tune against the photo. ──
const C = {
  casing: '#2FC49A',
  pcbTop: '#12386B',
  pcbBot: '#0E2E5C',
  shieldTop: '#C9CDD4',
  shieldBot: '#9AA0A8',
  antenna: '#1A1A1A',
  usbPurple: '#8E3FA8',
  buzzer: '#141414',
  screw: '#C9CDD4',
  hole: '#E9D9A8',
  silk: '#FFFFFF',
  silkDim: '#9DB0C9',
  i2c: ['#1B1B1B', '#D42E2E', '#2FA84F', '#E8C41F'], // GND, VCC, SCL, SDA (top→bottom)
  pwm: ['#E8C41F', '#D42E2E', '#1B1B1B'], // PWM, 5V, GND (top→bottom)
  active: '#8085F4',
} as const;

// Jumper-cable colors by real-world convention, per pin top→bottom.
const CABLE_I2C = ['#1B1B1B', '#D42E2E', '#2FA84F', '#2E6BE0']; // GND VCC SCL SDA
const CABLE_PWM = ['#E8C41F', '#D42E2E', '#1B1B1B']; // PWM 5V GND

export interface PortVisual {
  id: string; // 'P1'..'P5' | 'I1'..'I5'
  kind: 'pwm' | 'i2c';
  active?: boolean; // PWM port currently driven
  module?: 'servo' | 'oled' | null; // attached module
  pulsing?: boolean; // a block references it -> "plug something here"
}

// Column x-centers, exported so module cables can hook onto the right port.
export const I2C_COL_X = [187.5, 212.5, 237.5, 262.5, 287.5];
export const PWM_COL_X = [187.5, 212.5, 237.5, 262.5, 287.5];
export const I2C_TOP_Y = 20;
export const PWM_BOTTOM_Y = 271;

interface Props {
  rgb: { r: number; g: number; b: number } | null;
  buzzerActive: boolean;
  linkState: 'usb' | 'ble' | 'off';
  ports: PortVisual[];
  onPortClick?: (id: string) => void;
  showWires?: boolean; // draw live jumper cables for attached modules (default on)
}

export default function BoardSvg({ rgb, buzzerActive, linkState, ports, onPortClick, showWires = true }: Props) {
  const led = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null;
  const byId = (id: string) => ports.find((p) => p.id === id);

  // Colored cables from an attached port's real pins to a small plug just outside
  // the header — flowing (marching ants) = "alive". ponytail: short per-port bundles,
  // not routed across the board; this packed PCB has no clean lanes to the module.
  const cableBundle = (kind: 'pwm' | 'i2c', i: number, module: 'servo' | 'oled') => {
    const x = (kind === 'pwm' ? PWM_COL_X : I2C_COL_X)[i];
    const colors = kind === 'pwm' ? CABLE_PWM : CABLE_I2C;
    const y0 = kind === 'pwm' ? 225 : 18;
    const tagY = kind === 'pwm' ? 285 : 6; // plug sits just past the block
    const span = colors.length > 1 ? 18 / (colors.length - 1) : 0;
    return (
      <g key={`w-${kind}-${i}`} style={{ pointerEvents: 'none' }}>
        {colors.map((c, r) => {
          const pinY = y0 + r * 16 + 6;
          const ex = x - 9 + r * span; // fan into the plug
          const my = (pinY + tagY) / 2;
          const d = `M ${x} ${pinY} C ${x} ${my}, ${ex} ${my}, ${ex} ${tagY + (kind === 'pwm' ? 4 : -4)}`;
          return (
            <path key={r} d={d} fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="5 4" className={styles.wireFlow} />
          );
        })}
        <rect x={x - 14} y={tagY - 4} width={28} height={8} rx={2} fill="#1c1c1c" stroke="#3a3a3a" strokeWidth={0.6} />
        <text x={x} y={kind === 'pwm' ? tagY + 11 : tagY - 6} textAnchor="middle" fontSize={6} fontWeight={700} fill={C.silkDim}>
          {module === 'oled' ? 'OLED' : 'Servo'}
        </text>
      </g>
    );
  };

  const headerColumn = (kind: 'pwm' | 'i2c', i: number) => {
    const id = `${kind === 'pwm' ? 'P' : 'I'}${i + 1}`;
    const p = byId(id);
    const x = (kind === 'pwm' ? PWM_COL_X : I2C_COL_X)[i];
    const rows = kind === 'pwm' ? C.pwm : C.i2c;
    const y0 = kind === 'pwm' ? 225 : 18;
    const rowH = 16;
    const blockH = rows.length * rowH + 4;
    return (
      <g
        key={id}
        className={styles.portClick}
        role="button"
        tabIndex={0}
        aria-label={`Port ${kind === 'pwm' ? 'PWM' : 'I2C'} ${i + 1}${p?.module ? ` (modul ${p.module})` : ''}`}
        onClick={() => onPortClick?.(id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPortClick?.(id)}
      >
        {/* full-height hit + highlight area */}
        <rect
          x={x - 12}
          y={y0 - 2}
          width={24}
          height={blockH}
          rx={5}
          fill={p?.active ? 'rgba(129,133,244,0.25)' : 'transparent'}
          stroke={p?.active ? C.active : p?.pulsing ? '#F5C51877' : 'transparent'}
          strokeWidth={1.5}
        >
          {p?.pulsing && <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />}
        </rect>
        {rows.map((c, r) => (
          <g key={r}>
            <rect x={x - 9} y={y0 + r * rowH} width={18} height={12} rx={3} fill={c} />
            <rect x={x - 6} y={y0 + r * rowH - 3} width={12} height={3} rx={1} fill="#B9BEC9" />
          </g>
        ))}
        {/* attached-module dot */}
        {p?.module && (
          <circle cx={x} cy={kind === 'pwm' ? y0 + blockH + 3 : y0 - 6} r={3} fill={p.module === 'oled' ? '#2FC49A' : '#2F6FD0'} />
        )}
        <text
          x={x}
          y={kind === 'pwm' ? y0 - 5 : y0 + blockH + 8}
          textAnchor="middle"
          fontSize={8}
          fontWeight={800}
          fill={p?.active ? C.active : C.silkDim}
        >
          {id}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Papan Robotku Controller V3" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="pcb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.pcbTop} />
          <stop offset="1" stopColor={C.pcbBot} />
        </linearGradient>
        <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.shieldTop} />
          <stop offset="1" stopColor={C.shieldBot} />
        </linearGradient>
        <radialGradient id="ledGlow">
          <stop offset="0" stopColor={led ?? '#000'} stopOpacity={led ? 0.9 : 0} />
          <stop offset="1" stopColor={led ?? '#000'} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* LAPIS 0 — toska casing frame */}
      <rect x={2} y={2} width={396} height={296} rx={20} fill={C.casing} />
      <rect x={186} y={0} width={28} height={8} rx={3} fill={C.casing} />
      <rect x={186} y={292} width={28} height={8} rx={3} fill={C.casing} />

      {/* LAPIS 1 — PCB */}
      <rect x={16} y={16} width={368} height={268} rx={8} fill="url(#pcb)" />
      {[
        [30, 30],
        [370, 30],
        [30, 270],
        [370, 270],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={6} fill={C.hole} />
          <circle cx={cx} cy={cy} r={3.4} fill={C.screw} />
          <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke="#7d828c" strokeWidth={0.8} />
        </g>
      ))}

      {/* ESP32 shield + antenna (protruding left) */}
      <rect x={0} y={110} width={20} height={50} fill={C.antenna} />
      {Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 2 }, (_, c) => (
          <rect key={`${r}${c}`} x={2 + c * 9} y={114 + r * 9} width={6} height={6} fill="#2b2b2b" />
        )),
      )}
      <rect x={20} y={95} width={95} height={80} rx={6} fill="url(#shield)" stroke="#7d828c" strokeWidth={1} />
      <text x={67} y={139} textAnchor="middle" fontSize={11} fontWeight={800} fill="#5b6068">
        ESP-32
      </text>

      {/* BOOT / RESET buttons */}
      {[
        ['BOOT', 47],
        ['RESET', 214],
      ].map(([label, y]) => (
        <g key={label}>
          <rect x={28} y={y as number} width={18} height={18} rx={4} fill="#EEF0FF" stroke="#C6CAFF" />
          <circle cx={37} cy={(y as number) + 9} r={4} fill="#A3A8FB" />
          <text x={37} y={(y as number) - 3} textAnchor="middle" fontSize={6} fontWeight={700} fill={C.silkDim}>
            {label}
          </text>
        </g>
      ))}

      {/* Status LED (LED1) — link state */}
      <rect
        x={150}
        y={96}
        width={9}
        height={5}
        rx={1.5}
        className={linkState === 'ble' ? styles.bleBlink : undefined}
        fill={linkState === 'usb' ? '#2FA84F' : linkState === 'ble' ? '#3B82F6' : '#4a5570'}
      />
      <text x={162} y={101} fontSize={6} fontWeight={700} fill={C.silkDim}>
        LED1
      </text>

      {/* RGB LED 5mm */}
      {led && <circle cx={160} cy={130} r={26} fill="url(#ledGlow)" />}
      <circle cx={160} cy={130} r={11} fill={led ?? 'rgba(210,220,235,0.35)'} stroke="#ffffff55" strokeWidth={1} />
      <circle cx={156} cy={126} r={3} fill="#ffffffaa" />
      <text x={160} y={152} textAnchor="middle" fontSize={6} fontWeight={700} fill={C.silkDim}>
        RGB
      </text>

      {/* Buzzer */}
      {buzzerActive && (
        <g fill="none" stroke="#F265AE" strokeWidth={2}>
          <circle cx={172} cy={190} r={6} className={styles.wave} />
          <circle cx={172} cy={190} r={6} className={`${styles.wave} ${styles.wave2}`} />
          <circle cx={172} cy={190} r={6} className={`${styles.wave} ${styles.wave3}`} />
        </g>
      )}
      <circle cx={172} cy={190} r={26} fill={C.buzzer} />
      <circle cx={172} cy={190} r={17} fill="#232323" />
      <circle cx={172} cy={190} r={2.5} fill="#0a0a0a" />
      <text x={192} y={172} fontSize={7} fontWeight={800} fill="#8a8a8a">
        +
      </text>

      {/* ROBOTKU silkscreen */}
      <text x={215} y={98} fontSize={12} fontWeight={800} fontStyle="italic" fill={C.silk}>
        ROBOTKU
      </text>
      <text x={215} y={112} fontSize={9} fontWeight={800} fontStyle="italic" fill={C.silkDim}>
        SCHOOL
      </text>

      {/* Regulator + cap */}
      <rect x={300} y={55} width={30} height={20} rx={2} fill="#0f0f0f" />
      <rect x={334} y={60} width={8} height={12} rx={2} fill="#E08A2B" />

      {/* USB purple adaptor + socket (right edge) */}
      <rect x={305} y={120} width={60} height={45} rx={4} fill={C.usbPurple} />
      <rect
        x={365}
        y={130}
        width={22}
        height={26}
        rx={3}
        fill="#C2C6DB"
        stroke={linkState === 'usb' ? '#ffffff' : 'none'}
        strokeWidth={2}
      />

      {/* CH340C */}
      <rect x={300} y={185} width={44} height={22} rx={2} fill="#0f0f0f" />
      <text x={322} y={199} textAnchor="middle" fontSize={6} fill="#8a8a8a">
        CH340C
      </text>

      {/* Header labels (left of each block) */}
      <text x={168} y={16} textAnchor="end" fontSize={6} fontWeight={700} fill={C.silkDim}>
        I2C
      </text>
      <text x={168} y={232} textAnchor="end" fontSize={6} fontWeight={700} fill={C.silkDim}>
        PWM
      </text>

      {/* Headers */}
      {[0, 1, 2, 3, 4].map((i) => headerColumn('i2c', i))}
      {[0, 1, 2, 3, 4].map((i) => headerColumn('pwm', i))}

      {/* Live jumper cables for attached modules (on top of the pins = plugged in) */}
      {showWires &&
        ports.map((p) => (p.module ? cableBundle(p.kind, Number(p.id.slice(1)) - 1, p.module) : null))}
    </svg>
  );
}
