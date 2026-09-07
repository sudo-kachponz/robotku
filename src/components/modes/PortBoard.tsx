// src/components/modes/PortBoard.tsx
//
// Top-view of the Robotku Controller V3 board, drawn to match the real PCB (see
// sim.md): 5 I2C ports (4-pin GND/VCC/SCL/SDA) up top, ESP32 + RGB LED + buzzer in
// the middle, and 5 PWM/servo ports (3-pin PWM/5V/GND) along the bottom. Header
// colors come from hardware.ts so the SVG and the physical board can't drift.
// When active[i] is true, PWM port i glows. Shared by Port Control + the Block
// Coding SimStage (one copy, no duplication).

import { PWM_PORTS, I2C_PORTS } from '../../domain/hardware';
import styles from '../../styles/ModeControls.module.css';

export const CW = '#8085F4'; // clockwise → indigo
export const CCW = '#F265AE'; // anticlockwise → pink
const TRACK = 'rgba(255,255,255,0.18)';

/** Center-out track background, tinted by direction (used by the sliders). */
export function fillBg(v: number): string {
  const pct = 50 + v / 2;
  const a = Math.min(50, pct);
  const b = Math.max(50, pct);
  const color = v >= 0 ? CW : CCW;
  return `linear-gradient(to right, ${TRACK} 0 ${a}%, ${color} ${a}% ${b}%, ${TRACK} ${b}% 100%)`;
}

const PWM_X0 = 40;
const PWM_DX = 78;
const I2C_X0 = 46;
const I2C_DX = 78;

export default function PortBoard({ active, ledColor }: { active: boolean[]; ledColor?: string | null }) {
  // One PWM/servo port column (3 pins, board-edge -> inner: PWM yellow, 5V red, GND black).
  const pwmColumn = (port: (typeof PWM_PORTS)[number], i: number) => {
    const x = PWM_X0 + i * PWM_DX;
    const on = !!active[i];
    const [gnd, v5, pwm] = port.colors; // hardware order: GND,5V,PWM
    return (
      <g key={port.id} id={`port-${port.id}`}>
        <rect
          x={x - 6}
          y={247}
          width={44}
          height={62}
          rx={9}
          fill={on ? 'rgba(129,133,244,0.28)' : 'transparent'}
          stroke={on ? CW : 'transparent'}
          strokeWidth={2}
          style={{ transition: 'fill .15s ease, stroke .15s ease' }}
        />
        <text x={x + 16} y={243} textAnchor="middle" fontSize={12} fontWeight={800}
          fill={on ? CW : port.verified ? '#565386' : '#B9410088'}>
          {port.id}
        </text>
        <rect x={x} y={254} width={32} height={14} rx={4} fill={pwm} />
        <rect x={x} y={272} width={32} height={14} rx={4} fill={v5} />
        <rect x={x} y={290} width={32} height={14} rx={4} fill={gnd} />
      </g>
    );
  };

  // One I2C port column (4 pins: GND black, VCC red, SCL green, SDA yellow).
  const i2cColumn = (port: (typeof I2C_PORTS)[number], i: number) => {
    const x = I2C_X0 + i * I2C_DX;
    return (
      <g key={port.id} id={`port-${port.id}`}>
        <text x={x + 14} y={40} textAnchor="middle" fontSize={12} fontWeight={800} fill="#565386">
          {port.id}
        </text>
        {port.colors.map((c, r) => (
          <rect key={r} x={x} y={46 + r * 18} width={28} height={14} rx={4} fill={c} />
        ))}
      </g>
    );
  };

  return (
    <svg
      className={styles.portBoardSvg}
      viewBox="0 0 440 330"
      role="img"
      aria-label="Papan Robotku Controller V3 — 5 port PWM dan 5 port I2C"
    >
      {/* PCB */}
      <rect x={10} y={14} width={420} height={302} rx={20} fill="#FFFFFF" stroke="#E7E9F2" strokeWidth={2} />
      <circle cx={28} cy={32} r={5} fill="#EDEEF6" />
      <circle cx={412} cy={32} r={5} fill="#EDEEF6" />
      <circle cx={28} cy={298} r={5} fill="#EDEEF6" />
      <circle cx={412} cy={298} r={5} fill="#EDEEF6" />

      {/* I2C header block (top) + legend */}
      <text x={18} y={40} fontSize={10} fontWeight={700} fill="#9499B8">I2C</text>
      {I2C_PORTS.map((p, i) => i2cColumn(p, i))}

      {/* ESP32 module */}
      <rect x={150} y={120} width={140} height={64} rx={10} fill="#272350" />
      <rect x={158} y={128} width={90} height={24} rx={5} fill="#3A3470" />
      <text x={220} y={172} textAnchor="middle" fontSize={15} fontWeight={800} fill="#FFFFFF">ESP32</text>

      {/* USB (right edge) */}
      <rect x={414} y={150} width={16} height={28} rx={3} fill="#C2C6DB" />

      {/* RGB LED — lit by ledColor */}
      <circle cx={110} cy={150} r={11} fill={ledColor || 'rgba(60,64,120,0.18)'}
        style={{ filter: ledColor ? `drop-shadow(0 0 8px ${ledColor})` : 'none', transition: 'fill .2s ease' }} />
      <text x={110} y={182} textAnchor="middle" fontSize={9} fontWeight={700} fill="#9499B8">RGB</text>

      {/* Buzzer */}
      <circle cx={330} cy={150} r={13} fill="#1B1840" />
      <circle cx={330} cy={150} r={3} fill="#3A3470" />
      <text x={330} y={182} textAnchor="middle" fontSize={9} fontWeight={700} fill="#9499B8">BUZZ</text>

      {/* silkscreen */}
      <text x={402} y={118} textAnchor="end" fontSize={11} fontWeight={800} fill="#C2C6DB">ROBOTKU</text>

      {/* PWM header block (bottom) + legend */}
      <text x={18} y={272} fontSize={10} fontWeight={700} fill="#9499B8">PWM</text>
      {PWM_PORTS.map((p, i) => pwmColumn(p, i))}
    </svg>
  );
}
