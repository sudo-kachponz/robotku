// src/components/modes/RobotSprite.tsx
//
// Authentic Top-down 2D illustration of the Robotku physical robot kit:
// - Rectangular wooden dowel frame with white 3D-printed corner joints
// - Black rubber wheels on blue SG90 servos held in black wheel-servo casings
// - Front 0.96" OLED display module (black hard case) with wiring harness
// - Robotku Makerkit V1.3 white PCB in its black hard case: servo/AUX headers,
//   buzzer, 4× RGB LED, ESP32-S3 module, I2C bus, MAX98357A speaker amp, USB-C
// - Matte black power bank with white clamps and cyan LED percentage gauge
// - Dynamic translucent blue USB cable:
//     * Bluetooth / battery mode: loops from power bank into PCB USB port
//     * Serial mode: connects PCB directly out to host computer
// - Differential wheel spin animations matching drive intent

import { useConnection } from '../../hooks/useConnection';
import MakerkitBoardArt from '../blockcoding/sim/MakerkitBoardArt';
import styles from '../../styles/RobotSprite.module.css';

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export default function RobotSprite({
  fwd,
  turn,
  gripperOpen,
  reduced,
  headYaw,
  headPitch,
  connectionMode,
}: {
  fwd: number;
  turn: number;
  gripperOpen?: boolean;
  reduced?: boolean;
  headYaw?: number; // 80..100; omitted → no head marker
  headPitch?: number; // 80..100
  connectionMode?: 'auto' | 'bluetooth' | 'serial';
}) {
  const { transport, connState } = useConnection();

  // Determine whether USB cable is plugged into PC (Serial) or Power Bank (Bluetooth/Offline)
  const isSerial =
    connectionMode === 'serial'
      ? true
      : connectionMode === 'bluetooth'
        ? false
        : connState === 'connected' && transport?.kind === 'serial';

  // Head/sensor marker only renders when a yaw is supplied (Block Coding sim)
  const showHead = headYaw != null;
  const yawDeg = ((headYaw ?? 90) - 90) * 2.2;
  const pitchLift = ((headPitch ?? 90) - 90) * 0.4;

  // Differential wheels: forward spins both same way; turning spins them opposite
  const leftDir = reduced ? 0 : sign(fwd + turn);
  const rightDir = reduced ? 0 : sign(fwd - turn);

  const wheelClass = (dir: number) =>
    `${styles.wheel} ${dir > 0 ? styles.spinFwd : dir < 0 ? styles.spinBack : ''}`;

  const gripArm = (side: 'l' | 'r') =>
    `${styles.gripper} ${side === 'l' ? styles.gripperL : styles.gripperR} ${
      gripperOpen ? styles.open : styles.closed
    }`;

  return (
    <svg
      className={styles.svg}
      viewBox="0 0 200 240"
      role="img"
      aria-label="Ilustrasi Robotku Kit Asli"
    >
      <defs>
        {/* Wood dowel horizontal gradient */}
        <linearGradient id="woodH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ebd6b7" />
          <stop offset="50%" stopColor="#d5a575" />
          <stop offset="100%" stopColor="#b88350" />
        </linearGradient>

        {/* Wood dowel vertical gradient */}
        <linearGradient id="woodV" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ebd6b7" />
          <stop offset="50%" stopColor="#d5a575" />
          <stop offset="100%" stopColor="#b88350" />
        </linearGradient>


        {/* Black hard case */}
        <linearGradient id="hardCase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e2e33" />
          <stop offset="25%" stopColor="#1e1e21" />
          <stop offset="100%" stopColor="#0b0b0d" />
        </linearGradient>

        {/* Power Bank Matte Texture Gradient */}
        <linearGradient id="powerbankMatte" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="50%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#121215" />
        </linearGradient>

      </defs>

      {/* ── Ground Shadow ── */}
      <ellipse cx="100" cy="138" rx="74" ry="86" className={styles.shadow} />

      {/* ── Outer Wooden Chassis Box Frame (Light Wood Dowels) ── */}
      {/* Outer Rails */}
      <rect x="42" y="38" width="6" height="170" rx="3" fill="url(#woodV)" stroke="#9a693b" strokeWidth="0.5" />
      <rect x="152" y="38" width="6" height="170" rx="3" fill="url(#woodV)" stroke="#9a693b" strokeWidth="0.5" />
      <rect x="44" y="38" width="112" height="6" rx="3" fill="url(#woodH)" stroke="#9a693b" strokeWidth="0.5" />
      <rect x="44" y="202" width="112" height="6" rx="3" fill="url(#woodH)" stroke="#9a693b" strokeWidth="0.5" />

      {/* Center Longitudinal Support Rails */}
      <rect x="80" y="38" width="5" height="170" rx="2.5" fill="url(#woodV)" stroke="#9a693b" strokeWidth="0.4" />
      <rect x="115" y="38" width="5" height="170" rx="2.5" fill="url(#woodV)" stroke="#9a693b" strokeWidth="0.4" />

      {/* Middle Crossbar */}
      <rect x="44" y="112" width="112" height="5" rx="2.5" fill="url(#woodH)" stroke="#9a693b" strokeWidth="0.4" />

      {/* ── 3D-Printed White Corner Joints & Brackets ── */}
      {/* 4 Outer Corner Connectors */}
      <rect x="38" y="34" width="14" height="14" rx="2.5" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="1" />
      <rect x="148" y="34" width="14" height="14" rx="2.5" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="1" />
      <rect x="38" y="198" width="14" height="14" rx="2.5" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="1" />
      <rect x="148" y="198" width="14" height="14" rx="2.5" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="1" />

      {/* Center Top and Bottom Crossbar Mounts */}
      <rect x="76" y="35" width="48" height="10" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.8" />
      <rect x="76" y="200" width="48" height="10" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.8" />

      {/* Mid Rail T-Connectors */}
      <rect x="39" y="109" width="12" height="11" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.6" />
      <rect x="149" y="109" width="12" height="11" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.6" />

      {/* ── Power Bank (Matte Black with White Clamps & Battery LED Readout) ── */}
      <g id="powerbank">
        {/* Main Body */}
        <rect
          x="72"
          y="118"
          width="56"
          height="74"
          rx="7"
          fill="url(#powerbankMatte)"
          stroke="#3f3f46"
          strokeWidth="1"
        />

        {/* 4 White 3D-Printed Mounting Side Clamps */}
        <rect x="68" y="126" width="6" height="14" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.6" />
        <rect x="68" y="166" width="6" height="14" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.6" />
        <rect x="126" y="126" width="6" height="14" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.6" />
        <rect x="126" y="166" width="6" height="14" rx="2" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="0.6" />

        {/* Brand Subtle Texture */}
        <text
          x="100"
          y="148"
          textAnchor="middle"
          fill="#3f3f46"
          fontSize="5"
          fontWeight="800"
          letterSpacing="1"
        >
          ROBOTKU
        </text>

        {/* Digital Battery LED Display Window */}
        <rect x="79" y="174" width="42" height="12" rx="2" fill="#09090b" stroke="#27272a" strokeWidth="0.8" />
        <text x="84" y="183" className={styles.batteryLedGlow} fontSize="4.2" fontWeight="800">
          100
        </text>
        <text x="94" y="183" className={styles.batteryLedGlow} fontSize="4.2" fontWeight="800">
          75
        </text>
        <text x="103" y="183" className={styles.batteryLedGlow} fontSize="4.2" fontWeight="800">
          50
        </text>
        <text x="112" y="183" className={styles.batteryLedGlow} fontSize="4.2" fontWeight="800">
          25
        </text>

        {/* USB-A Port Connector at Bottom */}
        <rect x="94" y="188" width="12" height="5" rx="1" fill="#94a3b8" stroke="#64748b" strokeWidth="0.5" />
      </g>

      {/* ── Robotku Makerkit V1.3 (white PCB in black hard case): the shared board art
          (same drawing as the Block Coding simulator), scaled into its 58×52 slot ── */}
      <g id="pcb">
        <g transform="translate(71 51) scale(0.1487 0.1733)">
          <MakerkitBoardArt />
        </g>

        {/* Pulsing POWER LED, on top of the art's POWER LED (board 62,253) */}
        <circle cx="80.2" cy="94.8" r="1.8" fill="#ef4444" className={styles.redLedGlow} />

        {/* USB cable plug point at the case bottom */}
        <rect x="96" y="101" width="8" height="5" rx="1" fill="#94a3b8" stroke="#64748b" strokeWidth="0.5" />
      </g>

      {/* ── Servo Ribbon Cables (Brown/Red/Yellow) ── */}
      <path d="M42 124 C 55 124, 60 70, 78 70" fill="none" stroke="#78350f" strokeWidth="1.2" />
      <path d="M42 126 C 55 126, 60 72, 78 72" fill="none" stroke="#ef4444" strokeWidth="1.2" />
      <path d="M42 128 C 55 128, 60 74, 78 74" fill="none" stroke="#eab308" strokeWidth="1.2" />

      <path d="M158 124 C 145 124, 140 70, 122 70" fill="none" stroke="#78350f" strokeWidth="1.2" />
      <path d="M158 126 C 145 126, 140 72, 122 72" fill="none" stroke="#ef4444" strokeWidth="1.2" />
      <path d="M158 128 C 145 128, 140 74, 122 74" fill="none" stroke="#eab308" strokeWidth="1.2" />

      {/* ── Front OLED Display 0.96" (with Rainbow Wire Harness) ── */}
      <g id="oledDisplay">
        {/* 4 Jumper Wires from OLED to PCB */}
        <path d="M96 22 C 96 14, 88 32, 88 54" stroke="#eab308" strokeWidth="1" fill="none" />
        <path d="M98.5 22 C 98.5 14, 91 32, 91 54" stroke="#f97316" strokeWidth="1" fill="none" />
        <path d="M101.5 22 C 101.5 14, 109 32, 109 54" stroke="#0284c7" strokeWidth="1" fill="none" />
        <path d="M104 22 C 104 14, 112 32, 112 54" stroke="#22c55e" strokeWidth="1" fill="none" />

        {/* Black OLED hard case */}
        <rect x="84" y="22" width="32" height="22" rx="3" fill="url(#hardCase)" stroke="#3a3a40" strokeWidth="0.8" />
        {/* 4 Corner Screws */}
        <circle cx="86.5" cy="24.5" r="1" fill="#cbd5e1" />
        <circle cx="113.5" cy="24.5" r="1" fill="#cbd5e1" />
        <circle cx="86.5" cy="41.5" r="1" fill="#cbd5e1" />
        <circle cx="113.5" cy="41.5" r="1" fill="#cbd5e1" />

        {/* Black OLED Screen */}
        <rect x="87" y="25" width="26" height="16" rx="1.5" className={styles.oledScreen} />

        {/* OLED Screen Content */}
        <text x="100" y="32" textAnchor="middle" className={styles.oledTextGlow} fontSize="3.8" fontWeight="800">
          ROBOTKU
        </text>
        <text x="100" y="38" textAnchor="middle" fill="#facc15" fontSize="2.8" fontWeight="700">
          {isSerial ? 'USB SERIAL' : 'BLUETOOTH'}
        </text>
      </g>

      {/* ── Left Wheel & Servo in Black Casing ── */}
      <g id="leftMotorGroup">
        {/* Black wheel-servo casing */}
        <rect x="32" y="116" width="18" height="28" rx="3" fill="url(#hardCase)" stroke="#3a3a40" strokeWidth="0.8" />
        {/* Blue SG90 Servo Body */}
        <rect x="24" y="121" width="14" height="18" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />

        {/* Spoked Wheel with Tread Animation */}
        <g id="wheelL" className={wheelClass(leftDir)} style={{ transformOrigin: '24px 130px' }}>
          <circle cx="24" cy="130" r="22" className={styles.wheelTire} />
          <circle cx="24" cy="130" r="22" className={styles.wheelTreads} />

          {/* White rim + 4 cross spokes */}
          <circle cx="24" cy="130" r="14" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx="24" cy="130" r="11" fill="#e4e4e7" />
          <line x1="12" y1="130" x2="36" y2="130" className={styles.spoke} />
          <line x1="24" y1="118" x2="24" y2="142" className={styles.spoke} />
          <line x1="15.5" y1="121.5" x2="32.5" y2="138.5" className={styles.spoke} strokeWidth="1.6" />
          <line x1="15.5" y1="138.5" x2="32.5" y2="121.5" className={styles.spoke} strokeWidth="1.6" />

          {/* Wheel Hub */}
          <circle cx="24" cy="130" r="6.5" className={styles.hub} />
          <circle cx="24" cy="130" r="2" fill="#71717a" />
        </g>
      </g>

      {/* ── Right Wheel & Servo in Black Casing ── */}
      <g id="rightMotorGroup">
        {/* Black wheel-servo casing */}
        <rect x="150" y="116" width="18" height="28" rx="3" fill="url(#hardCase)" stroke="#3a3a40" strokeWidth="0.8" />
        {/* Blue SG90 Servo Body */}
        <rect x="162" y="121" width="14" height="18" rx="2" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.8" />

        {/* Spoked Wheel with Tread Animation */}
        <g id="wheelR" className={wheelClass(rightDir)} style={{ transformOrigin: '176px 130px' }}>
          <circle cx="176" cy="130" r="22" className={styles.wheelTire} />
          <circle cx="176" cy="130" r="22" className={styles.wheelTreads} />

          {/* White rim + 4 cross spokes */}
          <circle cx="176" cy="130" r="14" fill="#f4f4f2" stroke="#a1a1aa" strokeWidth="1" />
          <circle cx="176" cy="130" r="11" fill="#e4e4e7" />
          <line x1="164" y1="130" x2="188" y2="130" className={styles.spoke} />
          <line x1="176" y1="118" x2="176" y2="142" className={styles.spoke} />
          <line x1="167.5" y1="121.5" x2="184.5" y2="138.5" className={styles.spoke} strokeWidth="1.6" />
          <line x1="167.5" y1="138.5" x2="184.5" y2="121.5" className={styles.spoke} strokeWidth="1.6" />

          {/* Wheel Hub */}
          <circle cx="176" cy="130" r="6.5" className={styles.hub} />
          <circle cx="176" cy="130" r="2" fill="#71717a" />
        </g>
      </g>

      {/* ── Dynamic Translucent Blue USB Cable (Connection-Aware) ── */}
      {isSerial ? (
        /* Serial Mode: Cable leads straight down from PCB out to PC */
        <g id="usbSerialCable">
          <rect x="96" y="103" width="8" height="6" rx="1.5" className={styles.cableHead} />
          <path
            d="M100 107 L 100 240"
            fill="none"
            stroke="#0284c7"
            strokeWidth="4.2"
            strokeLinecap="round"
            className={styles.cableGlow}
          />
          <path
            d="M100 107 L 100 240"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Cable Tie / Clip */}
          <rect x="96" y="210" width="8" height="3" rx="1" fill="#0f172a" />
        </g>
      ) : (
        /* Bluetooth / Battery Mode: Cable loops from Power Bank into PCB */
        <g id="usbBatteryLoopCable">
          {/* Plug at Power Bank bottom */}
          <rect x="94" y="190" width="12" height="8" rx="2" className={styles.cableHead} />
          {/* Plug at PCB */}
          <rect x="96" y="103" width="8" height="6" rx="1.5" className={styles.cableHead} />

          {/* Blue Translucent Curved Loop */}
          <path
            d="M100 198 C 100 234, 144 234, 144 162 C 144 106, 100 106, 100 106"
            fill="none"
            stroke="#0284c7"
            strokeWidth="4.2"
            strokeLinecap="round"
            className={styles.cableGlow}
          />
          <path
            d="M100 198 C 100 234, 144 234, 144 162 C 144 106, 100 106, 100 106"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* ── Optional Ultrasonic Sensor Marker (Rotating with Yaw in Block Sim) ── */}
      {showHead && (
        <g transform={`rotate(${yawDeg} 100 36)`}>
          <rect
            x="84"
            y={12 - pitchLift}
            width="32"
            height="14"
            rx="3"
            fill="#f4f4f2"
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />
          {/* Dual Ultrasonic Transducers (Eyes) */}
          <circle cx="92" cy={19 - pitchLift} r="4.5" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          <circle cx="92" cy={19 - pitchLift} r="2.5" fill="#1e293b" />
          <circle cx="108" cy={19 - pitchLift} r="4.5" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          <circle cx="108" cy={19 - pitchLift} r="2.5" fill="#1e293b" />
        </g>
      )}

      {/* ── Optional Gripper Claws (Base Robot) ── */}
      {gripperOpen !== undefined && (
        <>
          <g className={gripArm('l')}>
            <path
              d="M82 36 L82 14 Q82 6 70 6 L60 6 Q68 18 72 26 L76 36 Z"
              fill="#f4f4f2"
              stroke="#a1a1aa"
              strokeWidth="1.5"
            />
          </g>
          <g className={gripArm('r')}>
            <path
              d="M118 36 L118 14 Q118 6 130 6 L140 6 Q132 18 128 26 L124 36 Z"
              fill="#f4f4f2"
              stroke="#a1a1aa"
              strokeWidth="1.5"
            />
          </g>
        </>
      )}
    </svg>
  );
}

