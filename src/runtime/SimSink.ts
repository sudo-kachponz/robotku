// src/runtime/SimSink.ts
//
// A RobotSink backed by a virtual robot model — pure math + an external store,
// NO WebGL. It mirrors the kinematics of Base Robot (BaseMode.tsx) so the 2D
// stage and the manual-drive screen feel identical, and it interprets the FULL
// v1.1 opcode set (movement, display, LCD, audio, sensor I/O) the 3D sequencer
// never covered. React reads it through subscribe()/getState().

import type { RobotSink } from './ProgramRunner';
import { portIndex, NUM_PORTS } from '../domain/ports';
import { cvStore } from '../ai/cvStore';

// Virtual arena — pose is kept in px inside a square stage, clamped to ±42% of the
// half-extent exactly like BaseMode's clamp(). SimStage renders in this same space.
export const SIM_STAGE = 276; // px (logical); SimStage draws at this size
const HALF = SIM_STAGE / 2;
const CLAMP = HALF * 0.42;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface SimState {
  // pose
  x: number;
  y: number;
  headingDeg: number;
  // drive intent (drives RobotSprite wheel spin)
  fwd: number;
  turn: number;
  // trail of recent poses (SimStage draws a fading polyline)
  trail: Array<{ x: number; y: number }>;
  // ports
  portValues: number[]; // 8, signed -100..100
  // gripper 0 (closed) .. 1 (open)
  gripperOpen: number;
  // head servos (Parts / mechanisms)
  headPitch: number;
  headYaw: number;
  // outputs
  matrix: number[]; // 25 (5x5), 0/1
  brightness: number; // 0..100
  displayText: string;
  lcdText: string;
  lcdShape: string | null;
  ledColor: string | null;
  buzzerHz: number;
  buzzerPulse: number; // performance.now() of last beep
  bpm: number;
  volume: number; // 0..100
  recording: number; // 1 while a RECORD_AUDIO is in progress
  clips: number[]; // 8 slots, recorded clip length in ms (0 = empty)
  // virtual sensors (scalars) + per-port I/O buses
  sensors: Record<string, number>;
  analogPorts: number[]; // 8
  digitalPorts: number[]; // 8
  // arena obstacle + collision feedback
  obstacle: { x: number; y: number } | null;
  collisions: number;
  bumpPulse: number; // performance.now() of last collision (arena flash)
  // status strip
  running: boolean;
  currentCommand: string | null;
  loopIteration: number;
  runStart: number;
}

export const OBSTACLE_R = 22; // px
const ROBOT_R = 24; // px

const NOTE_HZ: Record<string, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25,
};

function initialState(): SimState {
  return {
    x: 0,
    y: 0,
    headingDeg: 0,
    fwd: 0,
    turn: 0,
    trail: [],
    portValues: Array(8).fill(0),
    gripperOpen: 1,
    headPitch: 90,
    headYaw: 90,
    matrix: Array(25).fill(0),
    brightness: 100,
    displayText: '',
    lcdText: '',
    lcdShape: null,
    ledColor: null,
    buzzerHz: 0,
    buzzerPulse: 0,
    bpm: 120,
    volume: 80,
    recording: 0,
    clips: Array(8).fill(0),
    sensors: {
      ultrasonic: 200,
      distance: 0,
      light: 300,
      temperature: 27,
      humidity: 60,
      button1: 0,
      button2: 0,
    },
    analogPorts: Array(8).fill(0),
    digitalPorts: Array(8).fill(0),
    obstacle: null,
    collisions: 0,
    bumpPulse: 0,
    running: false,
    currentCommand: null,
    loopIteration: 0,
    runStart: 0,
  };
}

export class SimSink implements RobotSink {
  private state: SimState = initialState();
  private listeners = new Set<() => void>();
  private wakers = new Set<() => void>();
  private stopRequested = false;
  private lastEmit = 0;
  private odometry = 0; // cm travelled
  private volume = 0.8; // 0..1
  private simSpeed = 1; // matches ProgramRunner's speed multiplier
  private lastCollisionAt = 0;
  private audioCtx: AudioContext | null = null;

  // --- External store ------------------------------------------------------
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getState = (): SimState => this.state;

  private commit(partial: Partial<SimState>, force = false): void {
    this.state = { ...this.state, ...partial };
    const now = performance.now();
    // Throttle re-renders to ~40 fps for smooth-but-cheap animation.
    if (force || now - this.lastEmit >= 24) {
      this.lastEmit = now;
      for (const cb of this.listeners) cb();
    }
  }

  private emitNow(): void {
    this.lastEmit = performance.now();
    for (const cb of this.listeners) cb();
  }

  // --- RobotSink -----------------------------------------------------------
  async exec(cmd: { command: string; params: any }): Promise<void> {
    const { command, params = {} } = cmd;
    switch (command) {
      case 'MOVE_TIMED':
        await this.animateDrive(params, 'move');
        break;
      case 'TURN_TIMED':
        await this.animateDrive(params, 'turn');
        break;
      case 'STEER_TIMED':
        await this.animateDrive(params, 'steer');
        break;
      case 'CLAW_TIMED':
        await this.animateClaw(params);
        break;
      case 'STOP': {
        // Zero ONLY the named motor ports (LEFT/RIGHT), leaving others untouched.
        const next = [...this.state.portValues];
        for (const name of [params.left, params.right]) {
          const idx = portIndex(name);
          if (idx != null) next[idx] = 0;
        }
        this.commit({ fwd: 0, turn: 0, portValues: next }, true);
        break;
      }
      case 'STOP_ALL':
        this.commit({ fwd: 0, turn: 0, portValues: Array(NUM_PORTS).fill(0) }, true);
        break;
      case 'WAIT':
        await this.wait(durMs(params));
        break;
      case 'SET_HEAD_POSITION':
        this.commit({ headPitch: Number(params.pitch) || 90, headYaw: Number(params.yaw) || 90 }, true);
        break;
      case 'SET_GRIPPER':
        this.commit({ gripperOpen: params.state === 'open' ? 1 : 0 }, true);
        break;
      case 'SET_PORT': {
        const port = Number(params.port);
        if (port >= 1 && port <= 8) {
          const next = [...this.state.portValues];
          next[port - 1] = clampPort(params.value);
          this.commit({ portValues: next }, true);
        }
        break;
      }
      case 'DISPLAY_MATRIX': {
        this.commit({ matrix: normalizeMatrix(params.pattern) }, true);
        if (durMs(params) > 0) await this.sleep(durMs(params));
        break;
      }
      case 'DISPLAY_TEXT':
        this.commit({ displayText: String(params.text ?? '') }, true);
        break;
      case 'SET_LED_BRIGHTNESS':
        this.commit({ brightness: clamp(Number(params.value) || 0, 0, 100) }, true);
        break;
      case 'CLEAR_MATRIX':
        this.commit({ matrix: Array(25).fill(0), displayText: '' }, true);
        break;
      case 'LCD_SHAPE':
        this.commit({ lcdShape: String(params.shape ?? '') }, true);
        if (durMs(params) > 0) await this.sleep(durMs(params));
        break;
      case 'LCD_TEXT':
        this.commit({ lcdText: String(params.text ?? '') }, true);
        if (durMs(params) > 0) await this.sleep(durMs(params));
        break;
      case 'LCD_CLEAR':
        this.commit({ lcdText: '', lcdShape: null }, true);
        break;
      case 'SET_LED_COLOR': {
        const { r = 0, g = 0, b = 0 } = params;
        this.commit({ ledColor: `rgb(${r | 0}, ${g | 0}, ${b | 0})` }, true);
        break;
      }
      case 'DISPLAY_ICON':
        this.commit({ lcdShape: String(params.icon_name ?? params.icon ?? '') }, true);
        break;
      case 'PLAY_TONE': {
        const hz = NOTE_HZ[params.note] ?? 440;
        // `beats` resolves against BPM: ms = beats * 60000 / bpm.
        const ms =
          typeof params.beats === 'number'
            ? Math.max(1, (params.beats * 60000) / (this.state.bpm || 120))
            : durMs(params) || 300;
        this.beep(hz, ms);
        if (params.wait) await this.wait(ms);
        break;
      }
      case 'PLAY_SOUND_EFFECT':
      case 'PLAY_INTERNAL_SOUND': {
        this.beep(660, 200);
        if (params.wait) await this.wait(200);
        break;
      }
      case 'RECORD_AUDIO': {
        const slot = clamp((Number(params.slot) || 1) - 1, 0, 7);
        const ms = durMs(params) || 2000;
        const clips = [...this.state.clips];
        clips[slot] = ms;
        this.commit({ recording: 1, clips }, true);
        this.state.sensors.recording = 1;
        await this.wait(ms);
        this.state.sensors.recording = 0;
        this.commit({ recording: 0 }, true);
        break;
      }
      case 'PLAY_RECORDING': {
        const slot = clamp((Number(params.slot) || 1) - 1, 0, 7);
        const len = this.state.clips[slot];
        if (len > 0) {
          this.beep(520, Math.min(len, 1500));
          if (params.wait) await this.wait(len);
        } else {
          this.beep(200, 120); // empty slot → short error tone
        }
        break;
      }
      case 'SET_VOLUME': {
        const v = clamp(Number(params.value) || 0, 0, 100);
        this.volume = v / 100;
        this.commit({ volume: v }, true);
        break;
      }
      case 'SET_BPM':
        this.commit({ bpm: clamp(Number(params.bpm) || 120, 20, 300) }, true);
        break;
      case 'STOP_SOUNDS':
        this.commit({ buzzerHz: 0 }, true);
        break;
      case 'SET_ANALOG': {
        const idx = portIndex(params.port);
        if (idx != null) {
          const analogPorts = [...this.state.analogPorts];
          analogPorts[idx] = clamp(Number(params.value) || 0, 0, 255);
          this.commit({ analogPorts }, true);
        }
        break;
      }
      case 'SET_DIGITAL': {
        const idx = portIndex(params.port);
        if (idx != null) {
          const digitalPorts = [...this.state.digitalPorts];
          digitalPorts[idx] = params.value === 'HIGH' || params.value === 1 ? 1 : 0;
          this.commit({ digitalPorts }, true);
        }
        break;
      }
      case 'RESET_DISTANCE':
        this.odometry = 0;
        this.state.sensors.distance = 0;
        this.commit({ sensors: { ...this.state.sensors } }, true);
        break;
      case 'RESET_HEADING':
        this.commit({ headingDeg: 0 }, true);
        break;
      // --- AI camera (host-side; the robot never runs a model) ---
      case 'AI_CAMERA':
        if (params.on) void cvStore.startCamera();
        else cvStore.stop();
        break;
      case 'AI_SET_MODEL':
        if (params.model) void cvStore.setModel(String(params.model));
        break;
      default:
        // Unknown opcode → ignore, keep running.
        break;
    }
  }

  getSensorValue(getSensorDataJson: string): number | null {
    let sensor: string | undefined;
    let port: string | number | undefined;
    try {
      const parsed = JSON.parse(getSensorDataJson);
      // AI reporters resolve from cvStore's latest inference (safe defaults off).
      if (parsed?.command === 'GET_AI_DATA') return cvStore.getAiValue(parsed.params ?? {});
      sensor = parsed?.params?.sensor;
      port = parsed?.params?.port;
    } catch {
      return null;
    }
    if (!sensor) return null;
    const s = this.state.sensors;
    switch (sensor) {
      case 'ultrasonic':
      case 'proximity_front':
      case 'DISTANCE': // legacy alias
        return this.state.obstacle ? this.coneDistanceCm() : s.ultrasonic;
      case 'distance':
        return Math.round(this.odometry);
      case 'heading':
        return Math.round(this.state.headingDeg);
      case 'light':
        return Math.round(s.light + (Math.random() - 0.5) * 20);
      case 'temperature':
        return Math.round((s.temperature + (Math.random() - 0.5) * 1) * 10) / 10;
      case 'humidity':
        return Math.round(s.humidity + (Math.random() - 0.5) * 3);
      case 'button1':
        return s.button1;
      case 'button2':
        return s.button2;
      case 'recording':
        return this.state.recording;
      case 'analog': {
        const idx = portIndex(port ?? null);
        return idx != null ? this.state.analogPorts[idx] : 0;
      }
      case 'digital': {
        const idx = portIndex(port ?? null);
        return idx != null ? this.state.digitalPorts[idx] : 0;
      }
      default:
        return null; // unknown sensor must not crash the condition
    }
  }

  stopAll(): void {
    this.stopRequested = true;
    for (const wake of this.wakers) wake();
    this.wakers.clear();
    this.commit({ fwd: 0, turn: 0, portValues: Array(8).fill(0) }, true);
  }

  setSpeed(mult: number): void {
    this.simSpeed = mult > 0 ? mult : 1;
  }

  // --- Virtual sensor controls (driven by SimStage) ------------------------
  setUltrasonic(cm: number): void {
    this.state.sensors.ultrasonic = cm;
    this.commit({ sensors: { ...this.state.sensors } }, true);
  }

  setSensorScalar(name: 'light' | 'temperature' | 'humidity', value: number): void {
    this.state.sensors[name] = value;
    this.commit({ sensors: { ...this.state.sensors } }, true);
  }

  setAnalogPort(index0: number, value: number): void {
    const analogPorts = [...this.state.analogPorts];
    analogPorts[index0] = clamp(value, 0, 255);
    this.commit({ analogPorts }, true);
  }

  setDigitalPort(index0: number, high: boolean): void {
    const digitalPorts = [...this.state.digitalPorts];
    digitalPorts[index0] = high ? 1 : 0;
    this.commit({ digitalPorts }, true);
  }

  holdButton(which: 1 | 2, pressed: boolean): void {
    this.state.sensors[which === 1 ? 'button1' : 'button2'] = pressed ? 1 : 0;
    this.commit({ sensors: { ...this.state.sensors } }, true);
  }

  // --- Arena obstacle (draggable) ------------------------------------------
  setObstacle(x: number, y: number): void {
    this.commit({ obstacle: { x, y } }, true);
  }

  clearObstacle(): void {
    this.commit({ obstacle: null }, true);
  }

  // --- Status strip (driven by BlockCoding's runner callbacks) -------------
  setRunning(running: boolean): void {
    this.commit({ running, runStart: running ? performance.now() : this.state.runStart, loopIteration: running ? 0 : this.state.loopIteration }, true);
  }

  setStatus(currentCommand: string | null): void {
    this.commit({ currentCommand }, true);
  }

  setLoopIteration(n: number): void {
    this.commit({ loopIteration: n });
  }

  reset(): void {
    this.odometry = 0;
    this.state = initialState();
    this.emitNow();
  }

  // --- Kinematics ----------------------------------------------------------
  private async animateDrive(params: any, mode: 'move' | 'turn' | 'steer'): Promise<void> {
    this.stopRequested = false;
    const duration = (durMs(params) || 0) / this.simSpeed;
    const speed = Number(params.speed) || 70;
    const scale = speed / 70;

    // Port strip mirrors the wheel drive while the block runs (Port Control colours).
    const drive = Math.round(clampPort(speed) * (params.direction === 'backward' ? -1 : 1));
    let leftPort = 0;
    let rightPort = 0;
    if (mode === 'move') {
      leftPort = rightPort = drive;
      this.commit({ fwd: params.direction === 'backward' ? -1 : 1, turn: 0 });
    } else if (mode === 'turn') {
      const dir = params.direction === 'left' ? -1 : 1;
      leftPort = dir > 0 ? drive : -Math.abs(drive);
      rightPort = dir > 0 ? -Math.abs(drive) : drive;
      this.commit({ fwd: 0, turn: dir });
    } else {
      const steer = clamp(Number(params.steering) || 0, -100, 100) / 100;
      leftPort = Math.round(clampPort(speed) * (1 + Math.min(0, steer)));
      rightPort = Math.round(clampPort(speed) * (1 - Math.max(0, steer)));
      this.commit({ fwd: 1, turn: steer });
    }
    // Light the ports the block actually names, so the strip tells the truth.
    const li = portIndex(params.left) ?? 0;
    const ri = portIndex(params.right) ?? 1;
    const nextPorts = [...this.state.portValues];
    nextPorts[li] = leftPort;
    nextPorts[ri] = rightPort;
    this.commit({ portValues: nextPorts }, true);

    const start = performance.now();
    let last = start;
    while (!this.stopRequested) {
      const now = performance.now();
      if (now - start >= duration) break;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.integrate(dt * this.simSpeed, mode, params, scale);
      await this.sleep(16);
    }

    // Settle: zero velocity + decay the mirrored port strip back to neutral.
    const cleared = [...this.state.portValues];
    cleared[li] = 0;
    cleared[ri] = 0;
    this.commit({ fwd: 0, turn: 0, portValues: cleared }, true);
  }

  private integrate(dt: number, mode: 'move' | 'turn' | 'steer', params: any, scale: number): void {
    const p = { x: this.state.x, y: this.state.y, heading: this.state.headingDeg };

    if (mode === 'turn') {
      const dir = params.direction === 'left' ? -1 : 1;
      p.heading += dir * 90 * scale * dt;
    } else if (mode === 'move') {
      const dir = params.direction === 'backward' ? -1 : 1;
      const r = (p.heading * Math.PI) / 180;
      const dist = dir * 150 * scale * dt;
      p.x += Math.sin(r) * dist;
      p.y -= Math.cos(r) * dist;
      this.odometry += Math.abs(dist) / 10; // px → ~cm
    } else {
      // steer: blend forward motion with a turn rate proportional to steering.
      const steer = clamp(Number(params.steering) || 0, -100, 100) / 100;
      p.heading += steer * 90 * scale * dt;
      const r = (p.heading * Math.PI) / 180;
      const dist = 150 * scale * dt * (1 - Math.abs(steer) * 0.4);
      p.x += Math.sin(r) * dist;
      p.y -= Math.cos(r) * dist;
      this.odometry += Math.abs(dist) / 10;
    }

    p.x = clamp(p.x, -CLAMP, CLAMP);
    p.y = clamp(p.y, -CLAMP, CLAMP);

    // Collision with the arena obstacle: block the move, bump, flash, count.
    let bumpPulse = this.state.bumpPulse;
    let collisions = this.state.collisions;
    const obs = this.state.obstacle;
    if (obs) {
      const dx = p.x - obs.x;
      const dy = p.y - obs.y;
      if (Math.hypot(dx, dy) < ROBOT_R + OBSTACLE_R) {
        p.x = this.state.x; // don't advance into the obstacle
        p.y = this.state.y;
        const now = performance.now();
        bumpPulse = now;
        if (now - this.lastCollisionAt > 400) {
          collisions += 1;
          this.lastCollisionAt = now;
        }
      }
    }

    const trail = this.state.trail.concat({ x: p.x, y: p.y });
    if (trail.length > 200) trail.splice(0, trail.length - 200);

    this.state.sensors.distance = Math.round(this.odometry);
    this.commit({ x: p.x, y: p.y, headingDeg: p.heading, trail, bumpPulse, collisions });
  }

  /** Distance (cm) from the robot's sensor cone to the obstacle, else far. */
  private coneDistanceCm(): number {
    const obs = this.state.obstacle;
    if (!obs) return this.state.sensors.ultrasonic;
    const r = (this.state.headingDeg + (this.state.headYaw - 90)) * (Math.PI / 180);
    const fwd = { x: Math.sin(r), y: -Math.cos(r) };
    const dx = obs.x - this.state.x;
    const dy = obs.y - this.state.y;
    const dist = Math.hypot(dx, dy) || 1;
    const cos = (fwd.x * dx + fwd.y * dy) / dist; // cone alignment
    if (cos < Math.cos((35 * Math.PI) / 180)) return 200; // outside the cone
    return Math.max(0, Math.round((dist - ROBOT_R - OBSTACLE_R) / 10)); // 10 px ≈ 1 cm
  }

  private async animateClaw(params: any): Promise<void> {
    this.stopRequested = false;
    const duration = (durMs(params) || 600) / this.simSpeed;
    const target = params.direction === 'clockwise' ? 0 : 1; // clockwise = close
    const from = this.state.gripperOpen;
    const idx = portIndex(params.port);
    if (idx != null) {
      const p = [...this.state.portValues];
      p[idx] = clampPort(params.speed) * (target === 0 ? 1 : -1);
      this.commit({ portValues: p }, true);
    }
    const start = performance.now();
    while (!this.stopRequested) {
      const now = performance.now();
      const t = Math.min(1, (now - start) / duration);
      this.commit({ gripperOpen: from + (target - from) * t });
      if (t >= 1) break;
      await this.sleep(16);
    }
    if (idx != null) {
      const p = [...this.state.portValues];
      p[idx] = 0;
      this.commit({ gripperOpen: target, portValues: p }, true);
    } else {
      this.commit({ gripperOpen: target }, true);
    }
  }

  // --- Audio ---------------------------------------------------------------
  private beep(hz: number, ms: number): void {
    this.commit({ buzzerHz: hz, buzzerPulse: performance.now() }, true);
    try {
      if (typeof window === 'undefined') return;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = hz;
      gain.gain.value = 0.12 * this.volume;
      osc.connect(gain).connect(ctx.destination);
      const t0 = ctx.currentTime;
      osc.start(t0);
      osc.stop(t0 + ms / 1000);
    } catch {
      /* AudioContext blocked (autoplay policy) — never throw */
    }
  }

  // --- Interruptible sleep -------------------------------------------------
  // Program-level wait scales with the speed multiplier; frame cadence does not.
  private wait(ms: number): Promise<void> {
    return this.sleep(Math.max(1, ms / this.simSpeed));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.stopRequested) {
        resolve();
        return;
      }
      const wake = () => {
        clearTimeout(timer);
        this.wakers.delete(wake);
        resolve();
      };
      const timer = setTimeout(() => {
        this.wakers.delete(wake);
        resolve();
      }, ms);
      this.wakers.add(wake);
    });
  }
}

// --- helpers ---------------------------------------------------------------
function durMs(params: any): number {
  if (params == null) return 0;
  if (typeof params.duration_ms === 'number') return params.duration_ms;
  if (typeof params.ms === 'number') return params.ms;
  if (typeof params.secs === 'number') return params.secs * 1000;
  return 0;
}

function clampPort(v: any): number {
  return clamp(Math.round(Number(v) || 0), -100, 100);
}

/** Accept the looks.ts pattern in either number[] (25) or on/off string form. */
function normalizeMatrix(pattern: any): number[] {
  const out = Array(25).fill(0);
  if (Array.isArray(pattern)) {
    for (let i = 0; i < 25 && i < pattern.length; i++) out[i] = pattern[i] ? 1 : 0;
  } else if (typeof pattern === 'string') {
    for (let i = 0; i < 25 && i < pattern.length; i++) out[i] = pattern[i] === '1' ? 1 : 0;
  }
  return out;
}
