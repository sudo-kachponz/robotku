// src/components/blockcoding/sim/ServoModule.tsx
//
// SG90 servo (4.md): translucent blue body, toska mount, white 2-arm cross horn.
// speed (-100..100) -> horn spins continuously (continuous servos on this board);
// angle -> horn rotates to a fixed position. CSS-only motion.

import styles from './SimBoard.module.css';

const C = {
  body: '#2F6FD0',
  mount: '#2FC49A',
  horn: '#F4F7FF',
  wireOrange: '#E08A2B',
  wireRed: '#D42E2E',
  wireBrown: '#7a4a24',
} as const;

interface Props {
  angle?: number; // positional mode
  speed?: number; // continuous mode (-100..100)
}

export default function ServoModule({ angle, speed = 0 }: Props) {
  const spinning = Math.abs(speed) > 2;
  // faster speed -> shorter period (0.4s..2s); negative reverses direction.
  const dur = spinning ? `${Math.max(0.4, 2 - Math.abs(speed) / 65).toFixed(2)}s` : undefined;
  const hornStyle: React.CSSProperties = spinning
    ? ({ ['--spin-dur' as string]: dur, animationDirection: speed < 0 ? 'reverse' : 'normal' } as React.CSSProperties)
    : { transform: `rotate(${angle ?? 90}deg)`, transformOrigin: 'center', transition: 'transform 0.2s ease' };

  return (
    <svg viewBox="0 0 120 90" role="img" aria-label={`Servo SG90${spinning ? ' berputar' : ''}`} style={{ width: '100%', height: 'auto' }}>
      {/* 3 wires out the left */}
      <path d="M4 44 H26" stroke={C.wireOrange} strokeWidth={2.5} fill="none" />
      <path d="M4 50 H26" stroke={C.wireRed} strokeWidth={2.5} fill="none" />
      <path d="M4 56 H26" stroke={C.wireBrown} strokeWidth={2.5} fill="none" />

      {/* mount tabs */}
      <rect x={22} y={20} width={72} height={54} rx={4} fill={C.mount} />
      {/* body */}
      <rect x={30} y={16} width={56} height={62} rx={5} fill={C.body} fillOpacity={0.85} stroke="#1f4f97" />
      <text x={58} y={72} textAnchor="middle" fontSize={7} fontWeight={700} fill="#dbe7fb">
        SG90
      </text>

      {/* horn hub + 2-arm cross */}
      <g className={spinning ? styles.servoHornSpin : undefined} style={hornStyle}>
        <g transform="translate(58,40)">
          <rect x={-30} y={-4} width={60} height={8} rx={4} fill={C.horn} />
          <rect x={-4} y={-30} width={8} height={60} rx={4} fill={C.horn} />
          {[-26, -18, 18, 26].map((d) => (
            <circle key={d} cx={d} cy={0} r={1.6} fill="#c7d2e8" />
          ))}
          {[-26, -18, 18, 26].map((d) => (
            <circle key={`v${d}`} cx={0} cy={d} r={1.6} fill="#c7d2e8" />
          ))}
        </g>
      </g>
      <circle cx={58} cy={40} r={5} fill="#1f4f97" />
    </svg>
  );
}
