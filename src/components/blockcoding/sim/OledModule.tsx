// src/components/blockcoding/sim/OledModule.tsx
//
// External 0.96" SSD1306 OLED module (4.md): toska 3D frame, blue PCB, 4 labelled
// pins, black screen. The screen renders REAL content (text / 5x5 matrix / shape),
// not a placeholder, so DISPLAY_TEXT etc. look alive in the sim.

import styles from './SimBoard.module.css';

const C = {
  frame: '#2FC49A',
  pcb: '#123C7A',
  screen: '#050505',
  on: '#EAF6FF',
  off: 'rgba(255,255,255,0.08)',
  screw: '#C9CDD4',
  pin: '#C9CDD4',
} as const;

interface Props {
  text?: string;
  line2?: string;
  matrix?: boolean[]; // 25 cells, row-major
  shape?: string | null;
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

export default function OledModule({ text, line2, matrix, shape, dimmed }: Props) {
  const longText = (text?.length ?? 0) > 10;
  return (
    <svg viewBox="0 0 150 110" role="img" aria-label="Modul layar OLED" style={{ width: '100%', height: 'auto', opacity: dimmed ? 0.5 : 1 }}>
      {/* toska frame + screws */}
      <rect x={2} y={2} width={146} height={106} rx={10} fill={C.frame} />
      {[[12, 12], [138, 12], [12, 98], [138, 98]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.5} fill={C.screw} />
      ))}
      {/* PCB */}
      <rect x={16} y={16} width={118} height={78} rx={5} fill={C.pcb} />
      {/* pins GND VDD SCK SDA (left→right, per photo) */}
      {['GND', 'VDD', 'SCK', 'SDA'].map((label, i) => (
        <g key={label}>
          <rect x={28 + i * 24} y={20} width={8} height={6} rx={1.5} fill={C.pin} />
          <text x={32 + i * 24} y={34} textAnchor="middle" fontSize={5.5} fontWeight={700} fill="#cdd6e6">
            {label}
          </text>
        </g>
      ))}
      <text x={20} y={26} fontSize={5} fill="#9fb0cc">1</text>
      <text x={128} y={26} fontSize={5} fill="#9fb0cc">4</text>

      {/* screen */}
      <rect x={26} y={40} width={98} height={46} rx={2} fill={C.screen} stroke="#0d1b30" />
      <svg x={26} y={40} width={98} height={46} viewBox="0 0 128 64">
        {matrix ? (
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
