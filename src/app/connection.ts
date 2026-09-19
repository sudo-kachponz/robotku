// src/app/connection.ts
//
// Connection use-cases. UI calls these; they orchestrate the transport, the app
// store, the command_runner and telemetry. UI never touches a concrete transport
// directly — only this controller and the RobotTransport interface.

import { createTransport, type ConnState, type RobotInfo, type TransportKind } from '../transport';
import {
  setActiveTransport as storeSetTransport,
  setConnState,
  setRobotInfo,
  getState,
} from './store';
import { setActiveTransport as runnerSetTransport } from '../command_runner';
import { showToast } from '../ui/toast';

type TelemetryCb = (msg: any) => void;
const telemetryCbs = new Set<TelemetryCb>();

/**
 * Subscribe to telemetry frames. Returns an unsubscribe. Multiple subscribers
 * coexist (the Serial Monitor and telemetryCache both listen) — previously a
 * second subscriber silently replaced the first.
 */
export function onTelemetry(cb: TelemetryCb): () => void {
  telemetryCbs.add(cb);
  return () => {
    telemetryCbs.delete(cb);
  };
}

/** Fan a telemetry frame out to every subscriber (used by the active transport). */
export function dispatchTelemetry(msg: any): void {
  for (const cb of telemetryCbs) cb(msg);
}

// ── Persistent-connection state ──────────────────────────────────────────────
// Once connected, the link must survive page navigation and transient drops — only
// an explicit user disconnect ends it. Serial reuses getPorts(); BLE reuses
// getDevices() (see BleTransport), so both reconnect with NO user gesture.
let lastKind: TransportKind | null = null;
let userDisconnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 30;

function clearReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/** Schedule a silent reconnect after an UNEXPECTED drop (never after a user disconnect). */
function scheduleReconnect(): void {
  if (userDisconnected || lastKind == null) return;
  const st = getState();
  if (st.connState === 'connected' || st.connState === 'connecting') return;
  if (reconnectAttempts >= MAX_RECONNECT) return;
  clearReconnect();
  const delay = Math.min(800 + reconnectAttempts * 400, 4000);
  reconnectTimer = setTimeout(() => {
    reconnectAttempts += 1;
    connect(lastKind!, true).catch(() => scheduleReconnect());
  }, delay);
}

/** Tear down the active transport WITHOUT marking it a user disconnect. */
async function teardown(): Promise<void> {
  const { transport } = getState();
  if (!transport) return;
  await transport.disconnect().catch(() => {});
  runnerSetTransport(null);
  storeSetTransport(null);
}

/** Connect via the chosen transport, run the handshake, publish to the store. */
export async function connect(kind: TransportKind, isReconnect = false): Promise<RobotInfo> {
  clearReconnect();
  if (!isReconnect) {
    userDisconnected = false;
    reconnectAttempts = 0;
  }
  lastKind = kind;
  await teardown();

  const transport = createTransport(kind);

  transport.onState((s: ConnState) => {
    setConnState(s);
    if (s === 'connected') {
      reconnectAttempts = 0;
    } else if (s === 'error') {
      runnerSetTransport(null);
      if (!userDisconnected) {
        showToast('Koneksi terputus — menyambung ulang…', 'warn');
        scheduleReconnect();
      }
    } else if (s === 'disconnected') {
      runnerSetTransport(null);
      storeSetTransport(null);
      if (!userDisconnected) scheduleReconnect();
    }
  });

  transport.onTelemetry(dispatchTelemetry);

  storeSetTransport(transport);

  try {
    const info = await transport.connect();
    runnerSetTransport(transport);
    setRobotInfo(info);
    setConnState('connected');
    reconnectAttempts = 0;
    if (!isReconnect) showToast(`Connected · ${info.board} · fw ${info.fwVersion}`, 'success');
    return info;
  } catch (err) {
    runnerSetTransport(null);
    storeSetTransport(null);
    setConnState('disconnected');
    const message = err instanceof Error ? err.message : String(err);
    // A user cancelling the picker throws a NotFoundError — keep that quiet-ish and
    // don't retry (they chose not to pick a device).
    if (/cancel|NotFound|no device selected/i.test(message)) {
      if (!isReconnect) showToast('No device selected.', 'info');
    } else {
      if (!isReconnect) showToast(`Connection failed: ${message}`, 'error');
      scheduleReconnect(); // transient failure (board booting/out of range) → keep trying
    }
    throw err;
  }
}

let autoConnecting = false;

/**
 * Auto-reconnect on page load with NO click: if the user already granted a serial
 * port before (navigator.serial.getPorts()), reopen it and run the handshake.
 * getPorts() needs no user gesture, so the robot connects by itself every visit.
 * No-op when nothing is remembered (Web Serial can't prompt without a click) or
 * already connected — the Connect button still covers the first-time grant.
 */
export async function autoConnect(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serial) return false;
  // NEVER disturb an existing connection. This runs on mount of BOTH the Control and
  // Block Coding pages, so if the user connected over BLE on one page, opening the
  // other must not fire a serial connect — connect('serial') calls disconnect() first,
  // which tears down the live BLE link and then times out its own handshake (no
  // HELLO_ACK) on a board that's on battery/BLE only. connect() sets the store
  // transport before its handshake, so a truthy transport also catches an in-flight
  // BLE connect. Also guards StrictMode's double-invoke.
  const st = getState();
  if (autoConnecting || st.transport || st.connState === 'connected' || st.connState === 'connecting') {
    return false;
  }
  autoConnecting = true;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports.length === 0) return false;
    await connect('serial');
    return true;
  } catch {
    return false; // stay quiet; the Connect button still works
  } finally {
    autoConnecting = false;
  }
}

/** Disconnect the active transport (if any) — USER-initiated, so no auto-reconnect. */
export async function disconnect(): Promise<void> {
  userDisconnected = true;
  clearReconnect();
  await teardown();
}

/** Emergency stop through the active transport, if connected. */
export async function estop(): Promise<void> {
  const { transport } = getState();
  if (transport) {
    await transport.estop().catch((err) => console.warn('estop failed', err));
  }
}
