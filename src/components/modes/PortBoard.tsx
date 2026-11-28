// src/components/modes/PortBoard.tsx
//
// Port Control's board: the real Makerkit V1.3 (white PCB, black case) from the
// shared MakerkitBoardArt. When active[i] is true, the SERVO/AUX header whose
// silkscreen number is port i+1 glows (P1/P2 = drive servos, P5 = AUX servo); a
// port the board has no header for (P3/P4 on v1.3) just shows its chip.

import MakerkitBoardArt, { PWM_HEADER, SERVO_Y0, PITCH, CELL } from '../blockcoding/sim/MakerkitBoardArt';
import styles from '../../styles/ModeControls.module.css';

export const CW = '#8085F4'; // clockwise → indigo
export const CCW = '#F265AE'; // anticlockwise → pink
const TRACK = '#e7e9f2';

/** Center-out track background, tinted by direction (used by the sliders). */
export function fillBg(v: number): string {
  const pct = 50 + v / 2;
  const a = Math.min(50, pct);
  const b = Math.max(50, pct);
  const color = v >= 0 ? CW : CCW;
  return `linear-gradient(to right, ${TRACK} 0 ${a}%, ${color} ${a}% ${b}%, ${TRACK} ${b}% 100%)`;
}

// Silkscreen number -> header x (board-local), from the shared art.
const HEADER_X: Record<string, number> = Object.fromEntries(Object.values(PWM_HEADER).map((h) => [h.silk, h.x]));

export default function PortBoard({ active, ledColor }: { active: boolean[]; ledColor?: string | null }) {
  const headerH = 2 * PITCH + CELL;
  return (
    <svg
      className={styles.portBoardSvg}
      viewBox="-4 -22 398 326"
      role="img"
      aria-label="Papan Robotku Makerkit V1.3 — port servo P1, P2, P5"
    >
      <MakerkitBoardArt pixelColors={[0, 1, 2, 3].map(() => ledColor ?? null)}>
        {active.map((on, i) => {
          const x = HEADER_X[String(i + 1)];
          // shortcut: ports without a header (only P4 on v1.3) park their chip at x=150; give each its own spot if a board lacks more
          return (
            <g key={i}>
              {x != null && (
                <rect
                  x={x - 7.5}
                  y={SERVO_Y0 - 2}
                  width={15}
                  height={headerH + 4}
                  rx={3}
                  fill={on ? 'rgba(129,133,244,0.35)' : 'transparent'}
                  stroke={on ? CW : 'transparent'}
                  strokeWidth={1.6}
                  style={{ transition: 'fill .15s ease, stroke .15s ease' }}
                />
              )}
              <rect x={(x ?? 150) - 7} y={-18} width={14} height={11} rx={3} fill={on ? CW : x != null ? '#27272A' : '#3F3F46'} />
              <text x={x ?? 150} y={-10} textAnchor="middle" fontSize={6.6} fontWeight={800} fill={x != null ? '#FFFFFF' : '#A1A1AA'}>
                {`P${i + 1}`}
              </text>
            </g>
          );
        })}
      </MakerkitBoardArt>
    </svg>
  );
}
