// src/components/blockcoding/SimStage.tsx
//
// Full-fidelity 2D instrument panel (no WebGL). EVERY block in the toolbox
// produces a visible effect here: arena (pose + compass + head cone + draggable
// obstacle + collisions), port strip, output panel (matrix/LCD/RGB/buzzer/mic),
// a sensor rack with editable controls, a Variables watch and a status strip —
// plus run controls (speed / pause / step / reset). Reads a SimSink external
// store; adds no per-frame React state beyond the subscription + a 4 Hz clock.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import RobotSprite from '../modes/RobotSprite';
import PortBoard, { fillBg } from '../modes/PortBoard';
import { portLabel } from '../../domain/ports';
import { SIM_STAGE, OBSTACLE_R, type SimSink, type SimState } from '../../runtime/SimSink';
import { cvStore } from '../../ai/cvStore';
import styles from './SimStage.module.css';

const MATRIX_ON = '#3B82F6'; // category-blue
const SPEEDS = [0.25, 0.5, 1, 2, 4];

interface SimStageProps {
  sink: SimSink;
  reduced: boolean;
  running: boolean;
  paused: boolean;
  speed: number;
  scope: Record<string, unknown>;
  onSpeed: (mult: number) => void;
  onPauseToggle: () => void;
  onStepOne: () => void;
  onReset: () => void;
}

export default function SimStage(props: SimStageProps) {
  const { sink, reduced, running, paused, speed, scope } = props;
  const state = useSyncExternalStore(sink.subscribe, sink.getState, sink.getState);

  return (
    <div className={styles.stack}>
      <RunControls {...props} />
      <StatusStrip state={state} running={running} paused={paused} />
      <div className={styles.topGrid}>
        <ArenaSection sink={sink} state={state} reduced={reduced} />
        <OutputPanelSection state={state} reduced={reduced} />
      </div>
      <PortStripSection portValues={state.portValues} />
      <SensorRack sink={sink} state={state} />
      <VariablesWatch scope={scope} />
      {speed !== 1 && <div className={styles.speedNote} aria-hidden="true">Kecepatan simulasi ×{speed}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ controls */
function RunControls({ running, paused, speed, onSpeed, onPauseToggle, onStepOne, onReset }: SimStageProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.speedRow} role="group" aria-label="Kecepatan simulasi">
        {SPEEDS.map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.speedBtn} ${speed === m ? styles.speedActive : ''}`}
            onClick={() => onSpeed(m)}
          >
            {m}×
          </button>
        ))}
      </div>
      <div className={styles.ctrlBtns}>
        <button type="button" className={styles.ctrlBtn} onClick={onPauseToggle} disabled={!running} aria-label={paused ? 'Lanjutkan' : 'Jeda'}>
          {paused ? '▶' : '⏸'}
        </button>
        <button type="button" className={styles.ctrlBtn} onClick={onStepOne} aria-label="Langkah satu perintah">
          Langkah
        </button>
        <button type="button" className={styles.ctrlBtn} onClick={onReset} aria-label="Reset simulator">
          ⟲
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- status */
function StatusStrip({ state, running, paused }: { state: SimState; running: boolean; paused: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [running, paused]);

  const elapsed = running ? Math.max(0, (performance.now() - state.runStart) / 1000) : 0;
  const status = paused ? 'Jeda' : running ? 'Berjalan' : 'Berhenti';
  return (
    <div className={styles.status} role="status">
      <span className={`${styles.statusDot} ${running ? (paused ? styles.dotPaused : styles.dotRun) : ''}`} />
      <span>{status}</span>
      <span className={styles.statusSep}>·</span>
      <span>{state.currentCommand ?? '—'}</span>
      <span className={styles.statusSep}>·</span>
      <span>iterasi {state.loopIteration}</span>
      <span className={styles.statusSep}>·</span>
      <span>{elapsed.toFixed(1)} s</span>
      <span className={styles.statusSep}>·</span>
      <span>💥 {state.collisions}</span>
    </div>
  );
}

/* --------------------------------------------------------------------- arena */
function ArenaSection({ sink, state, reduced }: { sink: SimSink; state: SimState; reduced: boolean }) {
  const half = SIM_STAGE / 2;
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const bumping = performance.now() - state.bumpPulse < 220;

  const trail = state.trail.map((p) => `${(p.x + half).toFixed(1)},${(p.y + half).toFixed(1)}`).join(' ');

  // Ultrasonic cone geometry (from robot centre along heading + head yaw).
  const coneRad = (state.headingDeg + (state.headYaw - 90)) * (Math.PI / 180);
  const cx = state.x + half;
  const cy = state.y + half;
  const coneLen = 120;
  const spread = (35 * Math.PI) / 180;
  const p1 = [cx + Math.sin(coneRad - spread) * coneLen, cy - Math.cos(coneRad - spread) * coneLen];
  const p2 = [cx + Math.sin(coneRad + spread) * coneLen, cy - Math.cos(coneRad + spread) * coneLen];

  const pointToArena = (e: { clientX: number; clientY: number }) => {
    const rect = arenaRef.current!.getBoundingClientRect();
    const scale = SIM_STAGE / rect.width;
    return {
      x: (e.clientX - rect.left) * scale - half,
      y: (e.clientY - rect.top) * scale - half,
    };
  };

  return (
    <div
      className={`${styles.arena} ${bumping ? styles.arenaBump : ''}`}
      style={{ width: SIM_STAGE, height: SIM_STAGE }}
      ref={arenaRef}
    >
      <svg className={styles.trail} viewBox={`0 0 ${SIM_STAGE} ${SIM_STAGE}`} aria-hidden="true">
        {/* start marker */}
        <circle cx={half} cy={half} r={6} fill="none" stroke="#A3A8FB" strokeWidth={2} strokeDasharray="3 3" />
        {/* ultrasonic cone */}
        <polygon points={`${cx},${cy} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill="rgba(59,130,246,0.10)" stroke="rgba(59,130,246,0.25)" strokeWidth={1} />
        {/* trail */}
        {state.trail.length > 1 && (
          <polyline points={trail} fill="none" stroke="rgba(79,70,229,0.22)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* obstacle */}
        {state.obstacle && (
          <g
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => { if (dragging.current) { const p = pointToArena(e); sink.setObstacle(p.x, p.y); } }}
            onPointerUp={() => (dragging.current = false)}
          >
            <circle cx={state.obstacle.x + half} cy={state.obstacle.y + half} r={OBSTACLE_R} fill="#F59E0B" opacity={0.9} />
            <text x={state.obstacle.x + half} y={state.obstacle.y + half + 4} textAnchor="middle" fontSize={14}>🧱</text>
          </g>
        )}
      </svg>

      {/* compass ring */}
      <svg className={styles.compass} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx={20} cy={20} r={16} fill="none" stroke="#C6CAFF" strokeWidth={2} />
        <text x={20} y={9} textAnchor="middle" fontSize={7} fill="#565386" fontWeight={800}>U</text>
        <g transform={`rotate(${state.headingDeg} 20 20)`}>
          <polygon points="20,6 17,22 23,22" fill="#EC2D8F" />
        </g>
      </svg>

      {/* AI overlay: makes an AI program understandable offline */}
      <AiArenaOverlay robotX={cx} robotY={cy} />

      <div
        className={styles.robot}
        style={{ transform: `translate(${state.x}px, ${state.y}px) rotate(${state.headingDeg}deg)` }}
      >
        <RobotSprite
          fwd={state.fwd}
          turn={state.turn}
          gripperOpen={state.gripperOpen > 0.5}
          reduced={reduced}
          headYaw={state.headYaw}
          headPitch={state.headPitch}
        />
      </div>

      {/* readout chip + obstacle toggle */}
      <div className={styles.readout}>
        x {Math.round(state.x / 10)} · y {Math.round(-state.y / 10)} · θ {Math.round(state.headingDeg) % 360}°
      </div>
      <button
        type="button"
        className={styles.obstacleBtn}
        onClick={() => (state.obstacle ? sink.clearObstacle() : sink.setObstacle(0, -70))}
      >
        {state.obstacle ? 'Hapus rintangan' : 'Taruh rintangan'}
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- port strip */
function PortStripSection({ portValues }: { portValues: number[] }) {
  return (
    <div className={styles.section}>
      <PortBoard active={portValues.map((v) => v !== 0)} />
      <div className={styles.bars}>
        {portValues.map((v, i) => (
          <div key={i} className={styles.barRow}>
            <span className={styles.barNum}>{portLabel(i)}</span>
            <div className={styles.bar} style={{ background: fillBg(v) }} />
            <span className={styles.barVal}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- output panel */
function OutputPanelSection({ state, reduced }: { state: SimState; reduced: boolean }) {
  const buzzing = performance.now() - state.buzzerPulse < 260;
  const noteName = hzToNote(state.buzzerHz);
  return (
    <div className={styles.output}>
      <div className={styles.matrixWrap}>
        <div className={styles.matrix} role="img" aria-label="Pratinjau LED Matrix">
          {state.matrix.map((on, i) => (
            <span
              key={i}
              className={styles.dot}
              style={{ background: on ? MATRIX_ON : 'rgba(60,64,120,0.18)', opacity: on ? Math.max(0.35, state.brightness / 100) : 1 }}
            />
          ))}
        </div>
        {state.displayText && (
          <div className={styles.marqueeWrap} aria-label={`Teks berjalan: ${state.displayText}`}>
            <span className={reduced ? '' : styles.marquee}>{state.displayText}</span>
          </div>
        )}
      </div>

      <div className={styles.outputRight}>
        <LcdWidget shape={state.lcdShape} text={state.lcdText || state.displayText} />
        <div className={styles.outputRow}>
          <span className={styles.ledDot} style={{ background: state.ledColor ?? 'rgba(60,64,120,0.18)', boxShadow: state.ledColor ? `0 0 10px ${state.ledColor}` : 'none' }} aria-label="LED RGB" />
          <span
            className={styles.buzzer}
            style={{ background: buzzing ? '#F265AE' : 'rgba(60,64,120,0.18)', transform: buzzing ? 'scale(1.15)' : 'scale(1)' }}
            aria-label={buzzing ? `Buzzer ${noteName} ${Math.round(state.buzzerHz)} Hz` : 'Buzzer'}
          >
            ♪
          </span>
          <span className={styles.chip}>{buzzing ? `${noteName} ${Math.round(state.buzzerHz)}Hz` : '—'}</span>
        </div>
        <div className={styles.outputRow}>
          <span className={styles.metricLabel}>Vol</span>
          <div className={styles.volBar}><div style={{ width: `${state.volume}%` }} /></div>
          <span className={styles.chip}>BPM {state.bpm}</span>
        </div>
        {/* Microphone: recording lamp + 8 clip slots */}
        <div className={styles.micRow}>
          <span className={`${styles.recLamp} ${state.recording ? styles.recOn : ''}`} aria-label={state.recording ? 'Sedang merekam' : 'Mikrofon siap'} />
          {state.clips.map((len, i) => (
            <span key={i} className={`${styles.clip} ${len > 0 ? styles.clipFull : ''}`} title={`Slot ${i + 1}`}>{i + 1}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LcdWidget({ shape, text }: { shape: string | null; text: string }) {
  const line1 = text.slice(0, 16);
  const line2 = text.slice(16, 32);
  return (
    <div className={styles.lcd} aria-label="Layar LCD">
      {shape ? (
        <svg viewBox="0 0 40 40" className={styles.lcdShape}>{lcdShapePath(shape)}</svg>
      ) : (
        <div className={styles.lcdText}>
          <div>{line1 || 'LCD'}</div>
          <div>{line2}</div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- sensor rack */
function SensorRack({ sink, state }: { sink: SimSink; state: SimState }) {
  const s = state.sensors;
  return (
    <div className={styles.rack}>
      <div className={styles.rackTitle}>Sensor</div>
      <Slider label="Ultrasonic" unit="cm" min={0} max={200} value={state.obstacle ? sink.getSensorValue(JSON.stringify({ command: 'GET_SENSOR_DATA', params: { sensor: 'ultrasonic' } })) ?? 0 : s.ultrasonic} disabled={!!state.obstacle} onChange={(v) => sink.setUltrasonic(v)} />
      <Slider label="Cahaya" unit="lux" min={0} max={1000} value={s.light} onChange={(v) => sink.setSensorScalar('light', v)} />
      <Slider label="Suhu" unit="°C" min={-10} max={60} value={s.temperature} onChange={(v) => sink.setSensorScalar('temperature', v)} />
      <Slider label="Kelembapan" unit="%" min={0} max={100} value={s.humidity} onChange={(v) => sink.setSensorScalar('humidity', v)} />
      <div className={styles.roRow}>
        <span>Arah (heading)</span><b>{Math.round(state.headingDeg) % 360}°</b>
      </div>
      <div className={styles.roRow}>
        <span>Jarak tempuh</span><b>{s.distance} cm</b>
      </div>
      <div className={styles.holdRow}>
        <HoldBtn label="Button 1" active={!!s.button1} onHold={(p) => sink.holdButton(1, p)} />
        <HoldBtn label="Button 2" active={!!s.button2} onHold={(p) => sink.holdButton(2, p)} />
        <span className={`${styles.recLamp} ${state.recording ? styles.recOn : ''}`} title="Recording" />
      </div>
      <details className={styles.io}>
        <summary>Analog / Digital G1–G8</summary>
        <div className={styles.ioGrid}>
          {state.analogPorts.map((v, i) => (
            <label key={`a${i}`} className={styles.ioCell}>
              <span>A·G{i + 1}</span>
              <input type="number" min={0} max={255} value={v} onChange={(e) => sink.setAnalogPort(i, Number(e.target.value))} />
            </label>
          ))}
          {state.digitalPorts.map((v, i) => (
            <label key={`d${i}`} className={styles.ioCellToggle}>
              <span>D·G{i + 1}</span>
              <input type="checkbox" checked={!!v} onChange={(e) => sink.setDigitalPort(i, e.target.checked)} />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------- variables watch */
function VariablesWatch({ scope }: { scope: Record<string, unknown> }) {
  const keys = Object.keys(scope);
  return (
    <div className={styles.watch}>
      <div className={styles.rackTitle}>Variabel</div>
      {keys.length === 0 ? (
        <div className={styles.watchEmpty}>Belum ada variabel</div>
      ) : (
        <table className={styles.watchTable}>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td>{k}</td>
                <td className={styles.watchVal}>{String(scope[k])}</td>
                <td className={styles.watchType}>{typeof scope[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- atoms */
function Slider({ label, unit, min, max, value, disabled, onChange }: { label: string; unit: string; min: number; max: number; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <label className={styles.sliderRow}>
      <span>{label}</span>
      <input type="range" min={min} max={max} value={Math.round(value)} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <span className={styles.sliderVal}>{Math.round(value)} {unit}</span>
    </label>
  );
}

function HoldBtn({ label, active, onHold }: { label: string; active: boolean; onHold: (pressed: boolean) => void }) {
  return (
    <button
      type="button"
      className={`${styles.holdBtn} ${active ? styles.holdActive : ''}`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onHold(true); }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
    >
      {label}
    </button>
  );
}

/* --------------------------------------------------------------------- helpers */
function hzToNote(hz: number): string {
  if (!hz) return '';
  const table: [string, number][] = [['C4', 261.63], ['D4', 293.66], ['E4', 329.63], ['F4', 349.23], ['G4', 392], ['A4', 440], ['B4', 493.88], ['C5', 523.25]];
  let best = table[0];
  for (const t of table) if (Math.abs(t[1] - hz) < Math.abs(best[1] - hz)) best = t;
  return best[0];
}

function lcdShapePath(shape: string) {
  const stroke = { fill: 'none', stroke: '#1B1840', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (shape) {
    case 'heart':
      return <path d="M20 32 C6 22 8 10 20 16 C32 10 34 22 20 32 Z" fill="#EC2D8F" stroke="none" />;
    case 'smile':
      return <g {...stroke}><circle cx="20" cy="20" r="14" /><circle cx="15" cy="16" r="1.5" fill="#1B1840" /><circle cx="25" cy="16" r="1.5" fill="#1B1840" /><path d="M13 24 Q20 30 27 24" /></g>;
    case 'sad':
      return <g {...stroke}><circle cx="20" cy="20" r="14" /><circle cx="15" cy="16" r="1.5" fill="#1B1840" /><circle cx="25" cy="16" r="1.5" fill="#1B1840" /><path d="M13 27 Q20 21 27 27" /></g>;
    case 'star':
      return <path d="M20 6 24 16 35 16 26 23 29 34 20 27 11 34 14 23 5 16 16 16 Z" fill="#E0B000" stroke="none" />;
    case 'left_arrow':
      return <path d="M26 8 L12 20 L26 32" {...stroke} />;
    case 'right_arrow':
      return <path d="M14 8 L28 20 L14 32" {...stroke} />;
    case 'circle':
      return <circle cx="20" cy="20" r="13" {...stroke} />;
    case 'square':
      return <rect x="8" y="8" width="24" height="24" rx="3" {...stroke} />;
    default:
      return <text x="20" y="24" textAnchor="middle" fontSize="9" fill="#1B1840">{shape}</text>;
  }
}

/* ---------------------------------------------------------------- AI overlay */
function prettifyLabel(label: string): string {
  return label.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Draws what the AI camera sees inside the arena so an AI program is understandable
 * offline: a target marker at the detected box's centre (detection) or a winning
 * label chip above the robot (classification). Nothing when no model/camera.
 */
function AiArenaOverlay({ robotX, robotY }: { robotX: number; robotY: number }) {
  const ai = useSyncExternalStore(cvStore.subscribe, cvStore.getState, cvStore.getState);
  if (!ai.modelId) return null;

  if (ai.kind === 'detection') {
    const box = cvStore.getBox('any');
    if (!box) return null;
    const x = box.x * SIM_STAGE;
    const y = box.y * SIM_STAGE;
    return (
      <svg className={styles.trail} viewBox={`0 0 ${SIM_STAGE} ${SIM_STAGE}`} aria-hidden="true">
        <line x1={robotX} y1={robotY} x2={x} y2={y} stroke="rgba(236,45,143,0.4)" strokeWidth={2} strokeDasharray="4 4" />
        <circle cx={x} cy={y} r={12} fill="none" stroke="#EC2D8F" strokeWidth={3} />
        <circle cx={x} cy={y} r={3} fill="#EC2D8F" />
        <text x={x} y={y - 16} textAnchor="middle" fontSize={11} fontWeight={800} fill="#BE185D">
          {prettifyLabel(box.label)} {Math.round(box.score * 100)}%
        </text>
      </svg>
    );
  }

  // Classification → chip above the robot with the winning label.
  const top = ai.topLabel;
  if (!top) return null;
  const conf = cvStore.getConfidence(top);
  return (
    <div
      style={{
        position: 'absolute',
        left: robotX,
        top: Math.max(6, robotY - 46),
        transform: 'translateX(-50%)',
        background: '#EC2D8F',
        color: '#fff',
        fontWeight: 800,
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 4px 10px rgba(236,45,143,0.4)',
      }}
    >
      👁 {prettifyLabel(top)} {conf}%
    </div>
  );
}
