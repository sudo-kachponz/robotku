// src/components/modes/BaseRobotArt.tsx
//
// Top-down illustration of the real Robotku base robot (from the kit photos), drawn
// for the Base Robot control page. Front = up.
//   - wooden-dowel frame: double side rails, front/rear rails, two inner bars that
//     carry the board and the power bank; yellow corner joints, orange gussets,
//     black 3D-printed clips
//   - two green wheels seen edge-on (tread scrolls when they turn) on blue SG90
//     servos in yellow mounts, servo cables running to the board
//   - the real Makerkit V1.3 board (white PCB, black case) from MakerkitBoardArt,
//     the same drawing as the Block Coding simulator
//   - OLED module on the front rail with its ribbon cable, power bank at the rear
// Pure SVG + CSS so it scales crisply at any size; no state of its own.

import MakerkitBoardArt from '../blockcoding/sim/MakerkitBoardArt';
import styles from './BaseRobotArt.module.css';

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

// Repeating tread grooves; drawn one period past both ends so the scroll loops seamlessly.
const GROOVES = Array.from({ length: 15 }, (_, i) => i * 8 - 8);

function Wheel({ x, dir }: { x: number; dir: number }) {
  const spin = dir > 0 ? styles.spinFwd : dir < 0 ? styles.spinBack : '';
  return (
    <g className={spin}>
      <clipPath id={`rk-wheel-clip-${x}`}>
        <rect x={x} y={164} width={22} height={100} rx={7} />
      </clipPath>
      <rect x={x} y={164} width={22} height={100} rx={7} fill="url(#rk-tire)" />
      <g clipPath={`url(#rk-wheel-clip-${x})`}>
        <g className={styles.tread}>
          {GROOVES.map((gy) => (
            <rect key={gy} x={x} y={164 + gy} width={22} height={3} fill="#0d6b44" opacity={0.75} />
          ))}
        </g>
      </g>
      <rect x={x + 3} y={166} width={3} height={96} rx={1.5} fill="#ffffff" opacity={0.18} />
      <rect
        x={x}
        y={164}
        width={22}
        height={100}
        rx={7}
        fill="none"
        stroke="#0b5c3a"
        strokeWidth={1.2}
      />
    </g>
  );
}

/** One side's servo, mount, horn and cable (mirrored for the right side). */
function Drive({ right, endX }: { right?: boolean; endX: number }) {
  return (
    <g transform={right ? 'translate(320 0) scale(-1 1)' : undefined}>
      {/* horn / hub between wheel and servo */}
      <rect
        x={31}
        y={207}
        width={13}
        height={14}
        rx={2}
        fill="#f1f5f9"
        stroke="#94a3b8"
        strokeWidth={0.6}
      />
      {/* SG90 servo body (blue), mostly inside the yellow mount */}
      <rect
        x={38}
        y={202}
        width={34}
        height={24}
        rx={2}
        fill="#2563eb"
        stroke="#1e3a8a"
        strokeWidth={0.8}
      />
      <rect x={34} y={209} width={6} height={10} rx={1} fill="#1d4ed8" />
      {/* yellow 3D-printed servo mount clamped on the double side rails */}
      <rect
        x={44}
        y={194}
        width={36}
        height={40}
        rx={5}
        fill="url(#rk-yellow)"
        stroke="#b7791f"
        strokeWidth={0.9}
      />
      <rect x={48} y={198} width={28} height={6} rx={2} fill="#fde68a" opacity={0.7} />
      <circle cx={62} cy={214} r={4} fill="#ca8a04" opacity={0.55} />
      {/* servo cable: brown / red / orange, up into the PWM header */}
      {[
        ['#6b3a1f', -3],
        ['#dc2626', 0],
        ['#f59e0b', 3],
      ].map(([c, d]) => (
        <path
          key={String(c)}
          d={`M${72 + Number(d)} 200 C ${84 + Number(d)} 186, ${endX - 24 + Number(d)} 198, ${endX + Number(d)} 182`}
          fill="none"
          stroke={String(c)}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

export default function BaseRobotArt({
  fwd,
  turn,
  reduced,
  link,
}: {
  fwd: number;
  turn: number;
  reduced?: boolean;
  /** Active link — lights the board's BT (blue) or wifi (green) status LED. */
  link?: 'ble' | 'serial' | 'ws' | 'relay' | null;
}) {
  // Differential drive: forward spins both wheels the same way, turning spins them opposite.
  const leftDir = reduced ? 0 : sign(fwd + turn);
  const rightDir = reduced ? 0 : sign(fwd - turn);
  const btOn = link === 'ble';
  const wifiOn = link === 'ws' || link === 'relay';

  return (
    <svg
      className={styles.svg}
      viewBox="0 0 320 320"
      role="img"
      aria-label="Ilustrasi robot Robotku dilihat dari atas"
    >
      <defs>
        <linearGradient id="rk-woodV" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f3dfc1" />
          <stop offset="0.5" stopColor="#dcb487" />
          <stop offset="1" stopColor="#b98653" />
        </linearGradient>
        <linearGradient id="rk-woodH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3dfc1" />
          <stop offset="0.5" stopColor="#dcb487" />
          <stop offset="1" stopColor="#b98653" />
        </linearGradient>
        <linearGradient id="rk-tire" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#11784d" />
          <stop offset="0.45" stopColor="#2fd394" />
          <stop offset="1" stopColor="#11784d" />
        </linearGradient>
        <linearGradient id="rk-yellow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
        <linearGradient id="rk-bank" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2a2a2f" />
          <stop offset="0.5" stopColor="#18181b" />
          <stop offset="1" stopColor="#0e0e10" />
        </linearGradient>
        <filter id="rk-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* ground shadow */}
      <rect
        x={36}
        y={50}
        width={248}
        height={258}
        rx={26}
        fill="#000"
        opacity={0.32}
        filter="url(#rk-soft)"
      />

      {/* ── wooden frame ── */}
      {/* inner bars that carry the board + power bank */}
      <rect
        x={118}
        y={46}
        width={8}
        height={244}
        rx={4}
        fill="url(#rk-woodV)"
        stroke="#9a693b"
        strokeWidth={0.5}
      />
      <rect
        x={194}
        y={46}
        width={8}
        height={244}
        rx={4}
        fill="url(#rk-woodV)"
        stroke="#9a693b"
        strokeWidth={0.5}
      />
      {/* double side rails */}
      {[46, 64, 247, 265].map((x) => (
        <rect
          key={x}
          x={x}
          y={46}
          width={9}
          height={244}
          rx={4.5}
          fill="url(#rk-woodV)"
          stroke="#9a693b"
          strokeWidth={0.5}
        />
      ))}
      {/* front + rear rails */}
      <rect
        x={46}
        y={46}
        width={228}
        height={9}
        rx={4.5}
        fill="url(#rk-woodH)"
        stroke="#9a693b"
        strokeWidth={0.5}
      />
      <rect
        x={46}
        y={281}
        width={228}
        height={9}
        rx={4.5}
        fill="url(#rk-woodH)"
        stroke="#9a693b"
        strokeWidth={0.5}
      />

      {/* orange corner gussets */}
      {[
        'M55 55 L84 55 L55 84 Z',
        'M265 55 L236 55 L265 84 Z',
        'M55 281 L84 281 L55 252 Z',
        'M265 281 L236 281 L265 252 Z',
      ].map((d) => (
        <path
          key={d}
          d={d}
          fill="#f97316"
          stroke="#c2410c"
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
      ))}
      {/* yellow corner joints + T-joints where the inner side rails meet front/rear */}
      {[
        [39, 39, 24, 24],
        [257, 39, 24, 24],
        [39, 274, 24, 24],
        [257, 274, 24, 24],
        [61, 42, 15, 17],
        [244, 42, 15, 17],
        [61, 277, 15, 17],
        [244, 277, 15, 17],
      ].map(([x, y, w, h]) => (
        <g key={`${x}-${y}`}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={5}
            fill="url(#rk-yellow)"
            stroke="#b7791f"
            strokeWidth={0.9}
          />
          <rect
            x={x + 3}
            y={y + 2.5}
            width={w - 6}
            height={3}
            rx={1.5}
            fill="#fef9c3"
            opacity={0.65}
          />
        </g>
      ))}
      {/* green clips: inner bars on the front/rear rails, side rail mid-clips */}
      {[
        [113, 42, 18, 17],
        [189, 42, 18, 17],
        [113, 277, 18, 17],
        [189, 277, 18, 17],
        [43, 128, 34, 12],
        [243, 128, 34, 12],
      ].map(([x, y, w, h]) => (
        <rect
          key={`c${x}-${y}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={3.5}
          fill="#18181b"
          stroke="#000"
          strokeWidth={0.8}
        />
      ))}

      {/* ── wheels + drive ── */}
      <Wheel x={10} dir={leftDir} />
      <Wheel x={288} dir={rightDir} />
      {/* endX = local x of SERVO header 1 / 2 (right side is mirrored: 320 - x) */}
      <Drive endX={164.6} />
      <Drive right endX={159.4} />

      {/* ── power bank (rear, between the inner bars, overhanging the rear rail) ── */}
      <rect
        x={128}
        y={206}
        width={64}
        height={98}
        rx={9}
        fill="url(#rk-bank)"
        stroke="#000"
        strokeWidth={1}
      />
      <rect
        x={133}
        y={210}
        width={54}
        height={90}
        rx={6}
        fill="none"
        stroke="#3f3f46"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <path d="M136 296 L184 218" stroke="#ffffff" strokeWidth={10} opacity={0.035} />
      <rect
        x={150}
        y={204}
        width={20}
        height={5}
        rx={1.5}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth={0.5}
      />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={152 + i * 5.3} cy={218} r={1.4} fill={i < 3 ? '#22d3ee' : '#334155'} />
      ))}
      {/* green clips holding the power bank to the bars */}
      <rect
        x={114}
        y={236}
        width={20}
        height={12}
        rx={3}
        fill="#18181b"
        stroke="#000"
        strokeWidth={0.8}
      />
      <rect
        x={186}
        y={236}
        width={20}
        height={12}
        rx={3}
        fill="#18181b"
        stroke="#000"
        strokeWidth={0.8}
      />
      {/* USB power cable into the board */}
      <path
        d="M165 205 C 198 207, 226 186, 220 153"
        fill="none"
        stroke="#27272a"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M165 205 C 198 207, 226 186, 220 153"
        fill="none"
        stroke="#52525b"
        strokeWidth={1.2}
        strokeLinecap="round"
      />

      {/* ── controller: the real Makerkit V1.3 (white PCB, black 3D-printed case), shared
          art. Mounted rotated 180° like on the robot: SERVO headers face the rear
          (servo cables), I2C BUS faces the front (OLED ribbon), USB-C on the right. ── */}
      <g transform="translate(220.4 192.5) rotate(180) scale(0.31)">
        <MakerkitBoardArt bleOn={btOn} wifiOn={wifiOn} />
      </g>

      {/* ── OLED module on the front rail + ribbon cable ── */}
      {[
        ['#7c3aed', 0],
        ['#2563eb', 3],
        ['#16a34a', 6],
        ['#eab308', 9],
      ].map(([c, d]) => (
        <path
          key={String(c)}
          d={`M${155 + Number(d)} 88 C ${155 + Number(d)} 96, ${163 + Number(d) * 1.3} 98, ${163 + Number(d) * 1.3} 108`}
          fill="none"
          stroke={String(c)}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      <rect
        x={152}
        y={40}
        width={16}
        height={18}
        rx={3.5}
        fill="#18181b"
        stroke="#000"
        strokeWidth={0.8}
      />
      <rect
        x={140}
        y={52}
        width={40}
        height={38}
        rx={3}
        fill="#1e5aa8"
        stroke="#1e3a8a"
        strokeWidth={0.8}
      />
      {[0, 1, 2, 3].map((i) => (
        <circle key={`op${i}`} cx={152 + i * 5.3} cy={55.5} r={1.3} fill="#eab308" />
      ))}
      <rect
        x={143}
        y={60}
        width={34}
        height={26}
        rx={1.5}
        fill="#05070d"
        stroke="#0f172a"
        strokeWidth={0.6}
      />
      <text
        x={160}
        y={69}
        textAnchor="middle"
        fontSize={4.6}
        fontWeight={800}
        fill="#67e8f9"
        fontFamily="monospace"
      >
        ROBOTKU
      </text>
      {/* little OLED face */}
      <circle cx={154} cy={76} r={1.5} fill="#67e8f9" />
      <circle cx={166} cy={76} r={1.5} fill="#67e8f9" />
      <path
        d="M155 80 Q160 83.5 165 80"
        fill="none"
        stroke="#67e8f9"
        strokeWidth={1}
        strokeLinecap="round"
      />

      {/* front marker */}
      <path d="M160 16 L168 28 L152 28 Z" fill="#ffffff" opacity={0.5} />
    </svg>
  );
}
