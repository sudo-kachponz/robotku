// src/components/modes/PortMode.tsx
//
// Port Control — LARGE board illustration (left) + 8 full-width horizontal
// sliders stacked vertically (right), each labeled 1–8 with Anticlockwise ·
// Neutral · Clockwise direction labels. Slider range -100 (anticlockwise) …
// 0 (neutral, center detent) … +100 (clockwise) with a center-out fill.
//
// Behaviour is unchanged: live SET_PORT throttled ~20 Hz on drag (forced send on
// release), release snaps back to Neutral/0 (continuous-rotation servo), and
// Digit1..8 drive that port full clockwise (hold SHIFT to invert → anticlockwise).
// When a port is being driven its S/V/G row on the board lights up.

import { useCallback, useEffect, useRef, useState } from 'react';
import ControlLayout from '../control/ControlLayout';
import { useDrive } from '../../hooks/useDrive';
import styles from '../../styles/ModeControls.module.css';

const THROTTLE_MS = 50; // ~20 Hz

// Center-out fill colours (bright enough for the immersive indigo background).
const CW = '#8085F4'; // clockwise → indigo
const CCW = '#F265AE'; // anticlockwise → pink
const TRACK = 'rgba(255,255,255,0.18)';

// Build a center-out track background: coloured from the middle detent toward the
// thumb, tinted by direction; the rest of the track stays light/gray.
function fillBg(v: number): string {
  const pct = 50 + v / 2; // -100→0%, 0→50%, +100→100%
  const a = Math.min(50, pct);
  const b = Math.max(50, pct);
  const color = v >= 0 ? CW : CCW;
  return `linear-gradient(to right, ${TRACK} 0 ${a}%, ${color} ${a}% ${b}%, ${TRACK} ${b}% 100%)`;
}

export default function PortMode() {
  const { setPort } = useDrive();
  const [values, setValues] = useState<number[]>(() => Array(8).fill(0));
  const lastSent = useRef<number[]>(Array(8).fill(0));

  const sendThrottled = useCallback(
    (port: number, value: number) => {
      const now = performance.now();
      if (now - lastSent.current[port - 1] >= THROTTLE_MS) {
        lastSent.current[port - 1] = now;
        setPort(port, value);
      }
    },
    [setPort],
  );

  const setValue = useCallback(
    (port: number, value: number, force = false) => {
      setValues((prev) => {
        const next = [...prev];
        next[port - 1] = value;
        return next;
      });
      if (force) setPort(port, value);
      else sendThrottled(port, value);
    },
    [setPort, sendThrottled],
  );

  // Digit1..8 keybinds: drive full CLOCKWISE (+100); SHIFT = ANTICLOCKWISE (-100).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const m = /^Digit([1-8])$/.exec(e.code);
      if (!m || e.repeat) return;
      e.preventDefault();
      const port = Number(m[1]);
      setValue(port, e.shiftKey ? -100 : 100, true);
    };
    const up = (e: KeyboardEvent) => {
      const m = /^Digit([1-8])$/.exec(e.code);
      if (!m) return;
      e.preventDefault();
      setValue(Number(m[1]), 0, true); // release → Neutral
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setValue]);

  return (
    <ControlLayout title="Port Control">
      <div className={styles.portLayout}>
        {/* LEFT — board illustration (lights up the driven port row) */}
        <div className={styles.portBoardCol}>
          <PortBoard active={values.map((v) => v !== 0)} />
        </div>

        {/* RIGHT — 8 direction sliders */}
        <div className={styles.portRows}>
          <div className={styles.portHeader}>
            <span />
            <div className={styles.portHeaderLabels}>
              <span>Anticlockwise</span>
              <span>Neutral</span>
              <span>Clockwise</span>
            </div>
          </div>

          {Array.from({ length: 8 }, (_, i) => {
            const port = i + 1;
            const v = values[i];
            return (
              <div key={port} className={styles.portRow}>
                <span className={styles.portNum}>{port}</span>
                <div className={styles.portTrackWrap}>
                  <input
                    className={styles.portSlider}
                    type="range"
                    min={-100}
                    max={100}
                    value={v}
                    aria-label={`Port ${port} (kiri = anticlockwise, kanan = clockwise)`}
                    style={{ background: fillBg(v) }}
                    onChange={(e) => setValue(port, Number(e.target.value))}
                    onPointerUp={() => setValue(port, 0, true)}
                    onKeyUp={() => setValue(port, 0, true)}
                  />
                  <span className={styles.portDetent} aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ControlLayout>
  );
}

/* ---------------------------------------------------------------------------
 * PortBoard — clean top-view of the Robotku kit board. ESP32 module, USB, the
 * S/V/G port headers for ports 1–4 and 5–8 (yellow/red/black), SW1–SW4 buttons
 * and the "21" label. When active[port-1] is true, that port column glows.
 * ------------------------------------------------------------------------- */
function PortBoard({ active }: { active: boolean[] }) {
  const S = '#E0B000'; // signal (yellow)
  const V = '#E5484D'; // voltage (red)
  const G = '#1B1840'; // ground (black)

  const column = (port: number, x: number) => {
    const on = active[port - 1];
    return (
      <g key={port} id={`port-${port}`}>
        <rect
          x={x - 6}
          y={155}
          width={40}
          height={74}
          rx={9}
          fill={on ? 'rgba(129,133,244,0.28)' : 'transparent'}
          stroke={on ? CW : 'transparent'}
          strokeWidth={2}
          style={{ transition: 'fill .15s ease, stroke .15s ease' }}
        />
        <text
          x={x + 14}
          y={149}
          textAnchor="middle"
          fontSize={13}
          fontWeight={800}
          fill={on ? CW : '#565386'}
          style={{ transition: 'fill .15s ease' }}
        >
          {port}
        </text>
        <rect x={x} y={162} width={28} height={15} rx={4} fill={S} />
        <rect x={x} y={181} width={28} height={15} rx={4} fill={V} />
        <rect x={x} y={200} width={28} height={15} rx={4} fill={G} />
      </g>
    );
  };

  const legend = (bx: number) => (
    <g fill="#9499B8" fontSize={11} fontWeight={700} textAnchor="middle">
      <text x={bx} y={174}>S</text>
      <text x={bx} y={193}>V</text>
      <text x={bx} y={212}>G</text>
    </g>
  );

  return (
    <svg
      className={styles.portBoardSvg}
      viewBox="0 0 440 320"
      role="img"
      aria-label="Papan Robotku dengan port 1–8"
    >
      {/* PCB */}
      <rect x={10} y={14} width={420} height={296} rx={20} fill="#FFFFFF" stroke="#E7E9F2" strokeWidth={2} />

      {/* mounting holes */}
      <circle cx={28} cy={32} r={5} fill="#EDEEF6" />
      <circle cx={412} cy={32} r={5} fill="#EDEEF6" />
      <circle cx={28} cy={292} r={5} fill="#EDEEF6" />
      <circle cx={412} cy={292} r={5} fill="#EDEEF6" />

      {/* USB */}
      <rect x={205} y={6} width={30} height={16} rx={3} fill="#C2C6DB" />

      {/* ESP32 module */}
      <rect x={150} y={34} width={140} height={78} rx={10} fill="#272350" />
      <rect x={158} y={42} width={124} height={30} rx={5} fill="#3A3470" />
      <text x={220} y={98} textAnchor="middle" fontSize={16} fontWeight={800} fill="#FFFFFF">ESP32</text>

      {/* "21" board marker */}
      <text x={402} y={58} textAnchor="middle" fontSize={16} fontWeight={800} fill="#C2C6DB">21</text>

      {/* Port headers — block A (1–4) */}
      {legend(30)}
      {column(1, 46)}
      {column(2, 88)}
      {column(3, 130)}
      {column(4, 172)}

      {/* Port headers — block B (5–8) */}
      {legend(236)}
      {column(5, 252)}
      {column(6, 294)}
      {column(7, 336)}
      {column(8, 378)}

      {/* SW1–SW4 tactile buttons */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={46 + i * 52} y={250} width={30} height={30} rx={7} fill="#EEF0FF" stroke="#C6CAFF" strokeWidth={2} />
          <circle cx={61 + i * 52} cy={265} r={7} fill="#A3A8FB" />
          <text x={61 + i * 52} y={300} textAnchor="middle" fontSize={10} fontWeight={700} fill="#9499B8">SW{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}
