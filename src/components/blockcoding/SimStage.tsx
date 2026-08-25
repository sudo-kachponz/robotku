// src/components/blockcoding/SimStage.tsx
//
// The 2D simulator panel — same visual language as Base Robot + Port Control, and
// NO WebGL. It renders three stacked sections (robot stage, port strip, output
// panel) plus small "virtual sensor" controls, all driven by a SimSink external
// store. This is the default Block Coding simulator; the 3D path is opt-in beta.

import { useRef, useSyncExternalStore } from 'react';
import RobotSprite from '../modes/RobotSprite';
import PortBoard, { fillBg, CW, CCW } from '../modes/PortBoard';
import { SIM_STAGE, type SimSink, type SimState } from '../../runtime/SimSink';
import styles from './SimStage.module.css';

const MATRIX_ON = '#3B82F6'; // category-blue

export default function SimStage({ sink, reduced }: { sink: SimSink; reduced: boolean }) {
  const state = useSyncExternalStore(sink.subscribe, sink.getState, sink.getState);

  return (
    <div className={styles.stack}>
      <RobotStageSection state={state} reduced={reduced} />
      <PortStripSection portValues={state.portValues} />
      <OutputPanelSection state={state} />
      <VirtualSensors sink={sink} state={state} />
    </div>
  );
}

function RobotStageSection({ state, reduced }: { state: SimState; reduced: boolean }) {
  const half = SIM_STAGE / 2;
  const trail = state.trail
    .map((p) => `${(p.x + half).toFixed(1)},${(p.y + half).toFixed(1)}`)
    .join(' ');

  return (
    <div className={styles.arena} style={{ width: SIM_STAGE, height: SIM_STAGE }}>
      <svg className={styles.trail} viewBox={`0 0 ${SIM_STAGE} ${SIM_STAGE}`} aria-hidden="true">
        {state.trail.length > 1 && (
          <polyline points={trail} fill="none" stroke="rgba(79,70,229,0.2)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <div
        className={styles.robot}
        style={{ transform: `translate(${state.x}px, ${state.y}px) rotate(${state.headingDeg}deg)` }}
      >
        <RobotSprite
          fwd={state.fwd}
          turn={state.turn}
          gripperOpen={state.gripperOpen > 0.5}
          reduced={reduced}
        />
      </div>
    </div>
  );
}

function PortStripSection({ portValues }: { portValues: number[] }) {
  return (
    <div className={styles.section}>
      <PortBoard active={portValues.map((v) => v !== 0)} />
      <div className={styles.bars}>
        {portValues.map((v, i) => (
          <div key={i} className={styles.barRow}>
            <span className={styles.barNum}>{i + 1}</span>
            <div className={styles.bar} style={{ background: fillBg(v) }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputPanelSection({ state }: { state: SimState }) {
  const buzzing = performance.now() - state.buzzerPulse < 260;
  return (
    <div className={styles.output}>
      {/* 8x8-style LED matrix preview (5x5 to match DISPLAY_MATRIX) */}
      <div className={styles.matrix} role="img" aria-label="Pratinjau LED Matrix">
        {state.matrix.map((on, i) => (
          <span
            key={i}
            className={styles.dot}
            style={{
              background: on ? MATRIX_ON : 'rgba(60,64,120,0.18)',
              opacity: on ? Math.max(0.4, state.brightness / 100) : 1,
            }}
          />
        ))}
      </div>

      <div className={styles.outputRight}>
        <div className={styles.lcd}>
          {state.lcdShape ? `▣ ${state.lcdShape}` : state.lcdText || state.displayText || 'LCD'}
        </div>
        <div className={styles.outputRow}>
          <span className={styles.ledDot} style={{ background: state.ledColor ?? 'rgba(60,64,120,0.18)' }} />
          <span
            className={styles.buzzer}
            style={{ background: buzzing ? CCW : 'rgba(60,64,120,0.18)', transform: buzzing ? 'scale(1.15)' : 'scale(1)' }}
            title={state.buzzerHz ? `${Math.round(state.buzzerHz)} Hz` : 'buzzer'}
          >
            ♪
          </span>
        </div>
      </div>
    </div>
  );
}

function VirtualSensors({ sink, state }: { sink: SimSink; state: SimState }) {
  const b1 = useRef(false);
  const b2 = useRef(false);
  return (
    <div className={styles.sensors}>
      <label className={styles.sliderRow}>
        <span>Ultrasonic</span>
        <input
          type="range"
          min={0}
          max={200}
          value={state.sensors.ultrasonic}
          onChange={(e) => sink.setUltrasonic(Number(e.target.value))}
          style={{ background: fillBg(0), accentColor: CW }}
        />
        <span className={styles.sliderVal}>{Math.round(state.sensors.ultrasonic)} cm</span>
      </label>
      <div className={styles.buttonsRow}>
        <HoldBtn label="Button 1" active={!!state.sensors.button1} onHold={(p) => { b1.current = p; sink.holdButton(1, p); }} />
        <HoldBtn label="Button 2" active={!!state.sensors.button2} onHold={(p) => { b2.current = p; sink.holdButton(2, p); }} />
      </div>
    </div>
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
