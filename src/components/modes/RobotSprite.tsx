// src/components/modes/RobotSprite.tsx
//
// Top-down 2D illustration of the Robotku kit used by Base Robot. Purely visual:
// a chassis with two side wheels (#wheelL/#wheelR, with spokes so spin is visible)
// and a front gripper (#gripperL/#gripperR). Motion intent (fwd/turn) spins the
// wheels; `gripperOpen` opens/closes the claw. The parent moves/rotates the whole
// sprite via a transform on the wrapping element.

import styles from '../../styles/RobotSprite.module.css';

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export default function RobotSprite({
  fwd,
  turn,
  gripperOpen,
  reduced,
  headYaw,
  headPitch,
}: {
  fwd: number;
  turn: number;
  gripperOpen: boolean;
  reduced: boolean;
  headYaw?: number; // 80..100; omitted → no head marker (Base Robot look unchanged)
  headPitch?: number; // 80..100
}) {
  // Head/sensor marker only renders when a yaw is supplied (Block Coding sim).
  const showHead = headYaw != null;
  const yawDeg = ((headYaw ?? 90) - 90) * 2.2; // exaggerate for visibility
  const pitchLift = ((headPitch ?? 90) - 90) * 0.4;
  // Differential wheels: forward spins both same way; turning spins them opposite.
  const leftDir = reduced ? 0 : sign(fwd + turn);
  const rightDir = reduced ? 0 : sign(fwd - turn);

  const wheelClass = (dir: number) =>
    `${styles.wheel} ${dir > 0 ? styles.spinFwd : dir < 0 ? styles.spinBack : ''}`;
  const gripArm = (side: 'l' | 'r') =>
    `${styles.gripper} ${side === 'l' ? styles.gripperL : styles.gripperR} ${
      gripperOpen ? styles.open : styles.closed
    }`;

  return (
    <svg className={styles.svg} viewBox="0 0 200 240" role="img" aria-label="Ilustrasi robot Base">
      {/* soft ground shadow */}
      <ellipse cx="100" cy="150" rx="70" ry="78" className={styles.shadow} />

      {/* ---- Gripper (front / top) ---- */}
      <g className={gripArm('l')}>
        <path d="M78 78 L78 44 Q78 30 64 30 L52 30 Q60 42 66 52 L70 78 Z" className={styles.claw} />
      </g>
      <g className={gripArm('r')}>
        <path
          d="M122 78 L122 44 Q122 30 136 30 L148 30 Q140 42 134 52 L130 78 Z"
          className={styles.claw}
        />
      </g>

      {/* ---- Wheels (left / right) ---- */}
      <g id="wheelL" className={wheelClass(leftDir)} style={{ transformOrigin: '46px 130px' }}>
        <circle cx="46" cy="130" r="30" className={styles.tire} />
        <line x1="46" y1="104" x2="46" y2="156" className={styles.spoke} />
        <line x1="20" y1="130" x2="72" y2="130" className={styles.spoke} />
        <line x1="28" y1="112" x2="64" y2="148" className={styles.spoke} />
        <line x1="28" y1="148" x2="64" y2="112" className={styles.spoke} />
        <circle cx="46" cy="130" r="8" className={styles.hub} />
      </g>
      <g id="wheelR" className={wheelClass(rightDir)} style={{ transformOrigin: '154px 130px' }}>
        <circle cx="154" cy="130" r="30" className={styles.tire} />
        <line x1="154" y1="104" x2="154" y2="156" className={styles.spoke} />
        <line x1="128" y1="130" x2="180" y2="130" className={styles.spoke} />
        <line x1="136" y1="112" x2="172" y2="148" className={styles.spoke} />
        <line x1="136" y1="148" x2="172" y2="112" className={styles.spoke} />
        <circle cx="154" cy="130" r="8" className={styles.hub} />
      </g>

      {/* ---- Chassis / board ---- */}
      <rect x="62" y="74" width="76" height="112" rx="20" className={styles.chassis} />
      {/* battery pack */}
      <rect x="80" y="92" width="40" height="46" rx="8" className={styles.battery} />
      <rect x="88" y="100" width="24" height="6" rx="3" className={styles.batteryStripe} />
      <rect x="88" y="112" width="24" height="6" rx="3" className={styles.batteryStripe} />
      {/* status light */}
      <circle cx="100" cy="160" r="9" className={styles.light} />
      {/* front bumper accent */}
      <rect x="76" y="76" width="48" height="10" rx="5" className={styles.bumper} />

      {/* head / ultrasonic sensor marker — Block Coding only (rotates with yaw) */}
      {showHead && (
        <g transform={`rotate(${yawDeg} 100 74)`}>
          <rect x="86" y={58 - pitchLift} width="28" height="20" rx="6" className={styles.bumper} />
          <circle cx="94" cy={68 - pitchLift} r="3.4" fill="#1B1840" />
          <circle cx="106" cy={68 - pitchLift} r="3.4" fill="#1B1840" />
        </g>
      )}
    </svg>
  );
}
