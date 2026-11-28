// src/components/control/SetupArt.tsx
//
// Illustrations for the robot setup slides in the connect panel. Each scene uses the
// real board drawing (MakerkitBoardArt: white PCB, black case) plus simple props:
// power bank, laptop, phone, WiFi router, cloud. viewBox 400x210.

import MakerkitBoardArt from '../blockcoding/sim/MakerkitBoardArt';

type Scene = 'power' | 'link' | 'code' | 'wifi' | 'internet';

const INK = '#1e1b4b';
const PINK = '#ec2d8f';
const BLUE = '#3b82f6';
const GREEN = '#16a34a';

const Board = ({ x, y, s = 0.38 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <MakerkitBoardArt />
  </g>
);

const Label = ({
  x,
  y,
  text,
  color = INK,
}: {
  x: number;
  y: number;
  text: string;
  color?: string;
}) => (
  <text
    x={x}
    y={y}
    textAnchor="middle"
    fontSize={11}
    fontWeight={800}
    fill={color}
    fontFamily="var(--font, sans-serif)"
  >
    {text}
  </text>
);

/** USB cable (white, like the kit's), with a plug at the end. */
const Cable = ({ d }: { d: string }) => (
  <g fill="none" strokeLinecap="round">
    <path d={d} stroke="#94a3b8" strokeWidth={7} />
    <path d={d} stroke="#f8fafc" strokeWidth={4.5} />
  </g>
);

const PowerBank = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect width={62} height={112} rx={10} fill="#18181b" stroke="#000" />
    <rect x={5} y={5} width={52} height={102} rx={7} fill="none" stroke="#3f3f46" />
    {[0, 1, 2, 3].map((i) => (
      <circle key={i} cx={19 + i * 8} cy={20} r={2.2} fill={i < 3 ? '#22d3ee' : '#334155'} />
    ))}
    <rect x={21} y={-4} width={20} height={6} rx={2} fill="#cbd5e1" />
  </g>
);

const Laptop = ({ x, y, screen }: { x: number; y: number; screen?: React.ReactNode }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect width={130} height={84} rx={6} fill="#27272a" />
    <rect x={6} y={6} width={118} height={70} rx={3} fill="#eef2ff" />
    {screen}
    <path d="M -10 88 H 140 L 132 98 H -2 Z" fill="#a1a1aa" />
  </g>
);

const Phone = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect width={52} height={96} rx={9} fill="#27272a" />
    <rect x={4} y={9} width={44} height={78} rx={4} fill="#eef2ff" />
    <rect x={10} y={20} width={32} height={10} rx={3} fill={GREEN} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={10 + i * 11} y={40} width={9} height={9} rx={2} fill="#c7d2fe" />
    ))}
    {[0, 1, 2].map((i) => (
      <rect key={i} x={10 + i * 11} y={53} width={9} height={9} rx={2} fill="#c7d2fe" />
    ))}
  </g>
);

const Router = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={8} y={-34} width={5} height={36} rx={2} fill="#3f3f46" />
    <rect x={67} y={-34} width={5} height={36} rx={2} fill="#3f3f46" />
    <rect width={80} height={36} rx={8} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2} />
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={22 + i * 18} cy={18} r={3.5} fill={i === 0 ? GREEN : '#22d3ee'} />
    ))}
  </g>
);

const Cloud = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <path
      d="M 22 60 a 20 20 0 0 1 4 -39 a 28 28 0 0 1 52 -6 a 22 22 0 0 1 28 21 a 12 12 0 0 1 -2 24 Z"
      fill="#ffffff"
      stroke="#a5b4fc"
      strokeWidth={2.5}
    />
    <text x={60} y={46} textAnchor="middle" fontSize={10} fontWeight={800} fill="#4f46e5">
      RELAY
    </text>
  </g>
);

/** Concentric arcs (radio waves) pointing right from (x, y). */
const Waves = ({
  x,
  y,
  color,
  flip = false,
}: {
  x: number;
  y: number;
  color: string;
  flip?: boolean;
}) => (
  <g
    transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}
    fill="none"
    stroke={color}
    strokeLinecap="round"
    strokeWidth={4}
  >
    <path d="M 0 -10 A 12 12 0 0 1 0 10" />
    <path d="M 10 -20 A 24 24 0 0 1 10 20" opacity={0.75} />
    <path d="M 20 -30 A 36 36 0 0 1 20 30" opacity={0.5} />
  </g>
);

const Check = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={13} fill={GREEN} stroke="#fff" strokeWidth={3} />
    <path
      d="M -6 0 L -2 5 L 7 -5"
      fill="none"
      stroke="#fff"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>
);

export default function SetupArt({ scene }: { scene: Scene }) {
  return (
    <svg
      viewBox="0 0 400 210"
      role="img"
      aria-hidden="true"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {scene === 'power' && (
        <>
          <PowerBank x={40} y={58} />
          <Cable d="M 71 54 C 71 20, 175 22, 214 70 S 229 108, 230 108" />
          <Board x={226} y={46} />
          {/* POWER LED glow (board 62,253) */}
          <circle cx={226 + 62 * 0.38} cy={46 + 253 * 0.38} r={9} fill="#ef4444" opacity={0.45} />
          <Label x={71} y={190} text="Power bank" />
          <Label x={300} y={180} text="Lampu POWER merah" color={PINK} />
          <Label x={300} y={196} text="+ logo Robotku di OLED" color={PINK} />
        </>
      )}

      {scene === 'link' && (
        <>
          <Laptop
            x={22}
            y={40}
            screen={
              <>
                <rect x={30} y={22} width={70} height={14} rx={4} fill={BLUE} />
                <text x={65} y={32} textAnchor="middle" fontSize={8} fontWeight={800} fill="#fff">
                  Bluetooth
                </text>
                <rect x={30} y={42} width={70} height={14} rx={4} fill="none" stroke={BLUE} />
                <text x={65} y={52} textAnchor="middle" fontSize={8} fontWeight={800} fill={BLUE}>
                  USB
                </text>
              </>
            }
          />
          <Waves x={172} y={82} color={BLUE} />
          <Board x={236} y={40} s={0.36} />
          <Label x={86} y={178} text="Chrome / Edge" />
          <Label x={306} y={170} text="Bluetooth (robot di power bank)" color={BLUE} />
          <Label x={306} y={186} text="atau kabel USB ke laptop" color={INK} />
        </>
      )}

      {scene === 'code' && (
        <>
          <g transform="translate(24 52)">
            <rect width={150} height={92} rx={10} fill="#ffffff" stroke={PINK} strokeWidth={2.5} />
            <text x={75} y={26} textAnchor="middle" fontSize={11} fontWeight={800} fill={PINK}>
              KODE HARDWARE
            </text>
            <text
              x={75}
              y={52}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={800}
              fill={INK}
              fontFamily="monospace"
            >
              XXXX-XXXX
            </text>
            <text
              x={75}
              y={70}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={800}
              fill={INK}
              fontFamily="monospace"
            >
              XXXX-XXXX
            </text>
          </g>
          <path d="M 186 98 H 222" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <path
            d="M 214 88 L 226 98 L 214 108"
            fill="none"
            stroke={INK}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g transform="translate(238 62)">
            <rect width={140} height={72} rx={12} fill="#ecfdf5" stroke={GREEN} strokeWidth={2.5} />
            <text x={70} y={26} textAnchor="middle" fontSize={11} fontWeight={800} fill={GREEN}>
              KODE RELAY
            </text>
            <text
              x={70}
              y={54}
              textAnchor="middle"
              fontSize={20}
              fontWeight={900}
              fill={INK}
              fontFamily="monospace"
              letterSpacing={3}
            >
              A3B7K2
            </text>
          </g>
          <Label x={99} y={176} text="kartu di dalam box" />
          <Label x={308} y={160} text="identitas robotmu di internet" color={GREEN} />
        </>
      )}

      {scene === 'wifi' && (
        <>
          <Router x={36} y={92} />
          <Waves x={130} y={102} color={GREEN} />
          <Board x={214} y={52} s={0.4} />
          <Label x={76} y={160} text="WiFi rumah / sekolah" />
          <Label x={76} y={176} text="atau hotspot HP" />
          <Label x={292} y={190} text="harus 2.4 GHz" color={GREEN} />
        </>
      )}

      {scene === 'internet' && (
        <>
          <Board x={14} y={56} s={0.3} />
          <Cloud x={146} y={40} />
          <Phone x={318} y={44} />
          <path
            d="M 136 92 H 152"
            stroke="#a5b4fc"
            strokeWidth={4}
            strokeDasharray="4 6"
            strokeLinecap="round"
          />
          <path
            d="M 256 82 H 312"
            stroke="#a5b4fc"
            strokeWidth={4}
            strokeDasharray="4 6"
            strokeLinecap="round"
          />
          <Check x={206} y={124} />
          <Label x={72} y={168} text="robot (power bank)" />
          <Label x={206} y={166} text="internet" color="#4f46e5" />
          <Label x={344} y={168} text="HP / laptop" />
          <Label x={206} y={196} text="+ update firmware lewat WiFi (OTA)" color={GREEN} />
        </>
      )}
    </svg>
  );
}

export type { Scene };
