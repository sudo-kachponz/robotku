// src/components/modes/BaseRobotArt.tsx
//
// Top-down illustration of the real Robotku base robot (from the kit photos), drawn
// for the Base Robot control page. Front = up.
//   - wooden-dowel frame: double side rails, front/rear rails, two inner bars that
//     carry the board and the power bank; yellow corner joints, orange gussets,
//     green clips
//   - two green wheels seen edge-on (tread scrolls when they turn) on blue SG90
//     servos in yellow mounts, servo cables running to the board
//   - Makerkit ESP32-S3 v1.3 PCB in its yellow tray (ESP32-S3 module, buzzer, PWM
//     headers, 4 RGB LEDs, CH340C, USB-C, wifi/BT status LEDs)
//   - OLED module on the front rail with its ribbon cable, power bank at the rear
// Pure SVG + CSS so it scales crisply at any size; no state of its own.

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
function Drive({ right }: { right?: boolean }) {
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
          d={`M${72 + Number(d)} 200 C ${80 + Number(d)} 168, ${104 + Number(d)} 196, ${128 + Number(d)} 186`}
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
        <linearGradient id="rk-pcb" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#2f9e4a" />
          <stop offset="1" stopColor="#1d7a36" />
        </linearGradient>
        <linearGradient id="rk-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.55" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#94a3b8" />
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
          fill="#16a34a"
          stroke="#14532d"
          strokeWidth={0.8}
        />
      ))}

      {/* ── wheels + drive ── */}
      <Wheel x={10} dir={leftDir} />
      <Wheel x={288} dir={rightDir} />
      <Drive />
      <Drive right />

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
        fill="#16a34a"
        stroke="#14532d"
        strokeWidth={0.8}
      />
      <rect
        x={186}
        y={236}
        width={20}
        height={12}
        rx={3}
        fill="#16a34a"
        stroke="#14532d"
        strokeWidth={0.8}
      />
      {/* USB power cable into the board */}
      <path
        d="M140 205 C 138 199, 131 200, 129 195"
        fill="none"
        stroke="#27272a"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M140 205 C 138 199, 131 200, 129 195"
        fill="none"
        stroke="#52525b"
        strokeWidth={1.2}
        strokeLinecap="round"
      />

      {/* ── controller: yellow tray + Makerkit ESP32-S3 v1.3 PCB ── */}
      <rect
        x={110}
        y={94}
        width={100}
        height={104}
        rx={9}
        fill="url(#rk-yellow)"
        stroke="#b7791f"
        strokeWidth={1}
      />
      <rect
        x={104}
        y={132}
        width={8}
        height={18}
        rx={2.5}
        fill="#eab308"
        stroke="#b7791f"
        strokeWidth={0.8}
      />
      <rect
        x={208}
        y={132}
        width={8}
        height={18}
        rx={2.5}
        fill="#eab308"
        stroke="#b7791f"
        strokeWidth={0.8}
      />
      <rect
        x={117}
        y={101}
        width={86}
        height={90}
        rx={4}
        fill="url(#rk-pcb)"
        stroke="#14532d"
        strokeWidth={0.8}
      />
      {/* silkscreen outline + mounting holes */}
      <rect
        x={120}
        y={104}
        width={80}
        height={84}
        rx={3}
        fill="none"
        stroke="#bbf7d0"
        strokeWidth={0.4}
        opacity={0.6}
      />
      {[
        [121.5, 105.5],
        [198.5, 105.5],
        [121.5, 186.5],
        [198.5, 186.5],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={1.8}
          fill="#e5c07b"
          stroke="#a16207"
          strokeWidth={0.4}
        />
      ))}
      {/* ESP32-S3 module: antenna end + metal shield */}
      <rect x={160} y={104} width={36} height={44} rx={1.5} fill="#14532d" />
      <path
        d="M163 107 h6 v5 h6 v-5 h6 v5 h6 v-5 h6"
        fill="none"
        stroke="#facc15"
        strokeWidth={0.7}
        opacity={0.85}
      />
      <rect
        x={162}
        y={116}
        width={32}
        height={30}
        rx={1.5}
        fill="url(#rk-shield)"
        stroke="#64748b"
        strokeWidth={0.5}
      />
      <text
        x={178}
        y={128}
        textAnchor="middle"
        fontSize={3.6}
        fontWeight={700}
        fill="#475569"
        fontFamily="monospace"
      >
        ESP32-S3
      </text>
      <text
        x={178}
        y={133}
        textAnchor="middle"
        fontSize={2.6}
        fill="#64748b"
        fontFamily="monospace"
      >
        WROOM-2
      </text>
      {/* status LEDs: wifi (IO47) + BT (IO48) */}
      <circle
        cx={155}
        cy={110}
        r={2}
        fill={wifiOn ? '#4ade80' : '#14532d'}
        className={wifiOn ? styles.ledGlow : ''}
      />
      <circle
        cx={155}
        cy={117}
        r={2}
        fill={btOn ? '#60a5fa' : '#1e3a8a'}
        className={btOn ? styles.ledGlow : ''}
      />
      {/* buzzer */}
      <circle cx={136} cy={124} r={10} fill="#111827" stroke="#000" strokeWidth={0.8} />
      <circle cx={136} cy={124} r={6.5} fill="none" stroke="#374151" strokeWidth={1} />
      <circle cx={136} cy={124} r={1.6} fill="#000" />
      {/* OLED / I2C connector */}
      <rect x={124} y={104} width={14} height={4.5} rx={0.8} fill="#111" />
      {/* CH340C + regulator + passives */}
      <rect x={140} y={140} width={13} height={7} rx={0.8} fill="#1f2937" />
      <rect x={168} y={152} width={10} height={6} rx={0.8} fill="#1f2937" />
      <rect x={182} y={152} width={12} height={8} rx={0.8} fill="#334155" />
      {[
        [124, 141],
        [130, 141],
        [157, 152],
        [124, 147],
        [186, 163],
        [158, 140],
      ].map(([x, y]) => (
        <rect key={`p${x}-${y}`} x={x} y={y} width={3.5} height={1.8} rx={0.4} fill="#d6c7a1" />
      ))}
      {/* 4x WS2812B RGB LEDs */}
      {[0, 1, 2, 3].map((i) => (
        <g key={`led${i}`}>
          <rect
            x={160 + i * 9}
            y={166}
            width={6}
            height={6}
            rx={0.8}
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth={0.4}
          />
          <circle cx={163 + i * 9} cy={169} r={1.6} fill="#e2e8f0" />
        </g>
      ))}
      {/* PWM servo headers (3 pins each) */}
      <rect x={124} y={176} width={74} height={10} rx={1} fill="#111827" />
      {Array.from({ length: 6 }, (_, c) =>
        [0, 1, 2].map((r) => (
          <rect
            key={`h${c}-${r}`}
            x={127 + c * 12 + r * 3.2}
            y={179.5}
            width={2}
            height={3}
            fill="#eab308"
          />
        )),
      )}
      {/* USB-C */}
      <rect
        x={124}
        y={188}
        width={11}
        height={6}
        rx={2}
        fill="#e2e8f0"
        stroke="#64748b"
        strokeWidth={0.5}
      />
      {/* silkscreen */}
      <text
        x={136}
        y={161}
        textAnchor="middle"
        fontSize={5}
        fontWeight={800}
        fill="#ecfdf5"
        letterSpacing={0.3}
      >
        ROBOTKU
      </text>
      <text x={136} y={166.5} textAnchor="middle" fontSize={3} fill="#bbf7d0">
        Makerkit v1.3
      </text>

      {/* ── OLED module on the front rail + ribbon cable ── */}
      {[
        ['#7c3aed', 0],
        ['#2563eb', 3],
        ['#16a34a', 6],
        ['#eab308', 9],
      ].map(([c, d]) => (
        <path
          key={String(c)}
          d={`M${155 + Number(d)} 88 C ${155 + Number(d)} 96, ${126 + Number(d)} 96, ${126 + Number(d) / 1.5} 104`}
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
        fill="#16a34a"
        stroke="#14532d"
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
