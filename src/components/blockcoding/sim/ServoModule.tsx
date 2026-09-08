// src/components/blockcoding/sim/ServoModule.tsx
//
// SG90 Micro Servo Module: translucent blue polycarbonate body, mint/toska 3D
// mounting bracket, 3-wire flat ribbon cable (Orange/Red/Brown), white horn with holes.

import styles from './SimBoard.module.css';

const C = {
  casing: '#2FC49A',
  casingDark: '#1FA680',
  servoBody: '#1D4ED8',
  servoBodyTranslucent: 'rgba(29, 78, 216, 0.88)',
  servoTop: '#2563EB',
  gear: '#CBD5E1',
  horn: '#F8FAFC',
  hornBorder: '#CBD5E1',
  screw: '#94A3B8',
  wires: [
    { core: '#F59E0B', light: '#FCD34D', dark: '#D97706' }, // Orange (PWM)
    { core: '#DC2626', light: '#F87171', dark: '#B91C1C' }, // Red (5V)
    { core: '#78350F', light: '#92400E', dark: '#451A03' }, // Brown (GND)
  ],
} as const;

interface Props {
  angle?: number; // positional mode
  speed?: number; // continuous mode (-100..100)
}

export default function ServoModule({ angle, speed = 0 }: Props) {
  const spinning = Math.abs(speed) > 2;
  const dur = spinning ? `${Math.max(0.35, 1.8 - Math.abs(speed) / 70).toFixed(2)}s` : undefined;
  const hornStyle: React.CSSProperties = spinning
    ? ({ ['--spin-dur' as string]: dur, animationDirection: speed < 0 ? 'reverse' : 'normal' } as React.CSSProperties)
    : { transform: `rotate(${angle ?? 90}deg)`, transformOrigin: 'center', transition: 'transform 0.2s ease' };

  return (
    <svg
      viewBox="0 0 130 96"
      role="img"
      aria-label={`Servo SG90${spinning ? ' berputar' : ''}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* ── 3-Wire Flat Ribbon Cable Out Left ── */}
      {C.wires.map((w, i) => {
        const y = 44 + i * 6;
        const d = `M 4 ${y} C 16 ${y}, 22 ${y + 2}, 30 ${y + 2}`;
        return (
          <g key={`servo-wire-${i}`}>
            <path d={d} stroke={w.dark} strokeWidth={3.6} fill="none" strokeLinecap="round" />
            <path d={d} stroke={w.core} strokeWidth={2.8} fill="none" strokeLinecap="round" />
            <path d={d} stroke={w.light} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.8} />
            {spinning && (
              <path
                d={d}
                stroke="#FFFFFF"
                strokeWidth={1.2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="2 6"
                className={styles.wireFlowFast}
                opacity={0.85}
              />
            )}
          </g>
        );
      })}

      {/* Rubber Strain Relief Grommet */}
      <rect x={26} y={42} width={6} height={18} rx={2} fill="#18181B" stroke="#27272A" strokeWidth={0.6} />

      {/* ── Mint/Toska 3D Mounting Bracket ── */}
      <rect x={20} y={24} width={76} height={48} rx={5} fill={C.casing} stroke={C.casingDark} strokeWidth={1.2} />
      {/* Mounting Screw Holes */}
      <circle cx={26} cy={34} r={3} fill="#0F172A" opacity={0.3} />
      <circle cx={26} cy={62} r={3} fill="#0F172A" opacity={0.3} />
      <circle cx={90} cy={34} r={3} fill="#0F172A" opacity={0.3} />
      <circle cx={90} cy={62} r={3} fill="#0F172A" opacity={0.3} />

      {/* ── SG90 Translucent Blue Main Body ── */}
      <rect
        x={32}
        y={18}
        width={52}
        height={60}
        rx={6}
        fill={C.servoBodyTranslucent}
        stroke="#1E40AF"
        strokeWidth={1.5}
      />
      {/* Gear Silhouette inside the body */}
      <circle cx={62} cy={42} r={16} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={3} strokeDasharray="3 3" />
      <circle cx={48} cy={48} r={8} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2} strokeDasharray="2 2" />

      {/* Label "SG90 Micro Servo" */}
      <rect x={38} y={64} width={40} height={10} rx={2} fill="#1E3A8A" opacity={0.6} />
      <text x={58} y={72} textAnchor="middle" fontSize={6.5} fontWeight={900} fill="#BFDBFE" letterSpacing="0.5px">
        SG90 9g
      </text>

      {/* ── Output Gear Spline Shaft ── */}
      <circle cx={62} cy={42} r={7} fill="#1E3A8A" stroke="#3B82F6" strokeWidth={1} />
      <circle cx={62} cy={42} r={4.5} fill="#CBD5E1" />

      {/* ── 4-Arm Cross Servo Horn with Holes ── */}
      <g className={spinning ? styles.servoHornSpin : undefined} style={hornStyle}>
        <g transform="translate(62,42)">
          {/* Horizontal Arm */}
          <rect x={-28} y={-4} width={56} height={8} rx={4} fill={C.horn} stroke={C.hornBorder} strokeWidth={0.8} />
          {/* Vertical Arm */}
          <rect x={-4} y={-28} width={8} height={56} rx={4} fill={C.horn} stroke={C.hornBorder} strokeWidth={0.8} />
          {/* Center Hub */}
          <circle cx={0} cy={0} r={6.5} fill={C.horn} stroke={C.hornBorder} strokeWidth={0.8} />
          {/* Pin Holes along arms */}
          {[-22, -15, 15, 22].map((d) => (
            <circle key={`h-${d}`} cx={d} cy={0} r={1.4} fill="#64748B" />
          ))}
          {[-22, -15, 15, 22].map((d) => (
            <circle key={`v-${d}`} cx={0} cy={d} r={1.4} fill="#64748B" />
          ))}
          {/* Center Mounting Screw */}
          <circle cx={0} cy={0} r={2.8} fill={C.screw} />
          <line x1={-1.5} y1={0} x2={1.5} y2={0} stroke="#475569" strokeWidth={0.6} />
        </g>
      </g>
    </svg>
  );
}

