// src/app/store.ts
//
// Tiny framework-agnostic app store (plain TS, no deps). Holds the single source
// of truth for the active transport, connection state, board info and current
// module. UI subscribes; nothing here imports Blockly or DOM.

import type { ConnState, RobotInfo, RobotTransport } from '../transport';

export type AppMode = 'home' | 'blocks' | 'joystick';

export interface AppState {
  mode: AppMode;
  transport: RobotTransport | null;
  connState: ConnState;
  robotInfo: RobotInfo | null;
}

type Listener = (state: AppState) => void;

const state: AppState = {
  mode: 'home',
  transport: null,
  connState: 'disconnected',
  robotInfo: null,
};

const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) {
    try {
      l(getState());
    } catch (err) {
      console.warn('[store] listener threw', err);
    }
  }
}

export function getState(): Readonly<AppState> {
  return { ...state };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

export function setMode(mode: AppMode): void {
  if (state.mode === mode) return;
  state.mode = mode;
  emit();
}

export function setConnState(connState: ConnState): void {
  if (state.connState === connState) return;
  state.connState = connState;
  if (connState === 'disconnected') state.robotInfo = null;
  emit();
}

export function setRobotInfo(info: RobotInfo | null): void {
  state.robotInfo = info;
  emit();
}

/**
 * Register a live transport with the store. Wires its state stream so the whole
 * app reacts, and mirrors the active transport into command_runner.
 */
export function setActiveTransport(transport: RobotTransport | null): void {
  state.transport = transport;
  if (!transport) {
    state.connState = 'disconnected';
    state.robotInfo = null;
  }
  emit();
}

export function isConnected(): boolean {
  return state.connState === 'connected' && state.transport !== null;
}
