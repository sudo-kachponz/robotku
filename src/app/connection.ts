// src/app/connection.ts
//
// Connection use-cases. UI calls these; they orchestrate the transport, the app
// store, the command_runner and telemetry. UI never touches a concrete transport
// directly — only this controller and the RobotTransport interface.

import {
  createTransport,
  type ConnState,
  type RobotInfo,
  type TransportKind,
} from '../transport';
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

/** Connect via the chosen transport, run the handshake, publish to the store. */
export async function connect(kind: TransportKind): Promise<RobotInfo> {
  // Tear down any previous connection first.
  await disconnect();

  const transport = createTransport(kind);

  transport.onState((s: ConnState) => {
    setConnState(s);
    if (s === 'error') {
      showToast('Connection lost — robot stopped (failsafe).', 'error');
    } else if (s === 'disconnected') {
      runnerSetTransport(null);
      storeSetTransport(null);
    }
  });

  transport.onTelemetry(dispatchTelemetry);

  storeSetTransport(transport);

  try {
    const info = await transport.connect();
    runnerSetTransport(transport);
    setRobotInfo(info);
    setConnState('connected');
    showToast(`Connected · ${info.board} · fw ${info.fwVersion}`, 'success');
    return info;
  } catch (err) {
    runnerSetTransport(null);
    storeSetTransport(null);
    setConnState('disconnected');
    const message = err instanceof Error ? err.message : String(err);
    // A user cancelling the picker throws a NotFoundError — keep that quiet-ish.
    if (/cancel|NotFound|no device selected/i.test(message)) {
      showToast('No device selected.', 'info');
    } else {
      showToast(`Connection failed: ${message}`, 'error');
    }
    throw err;
  }
}

/** Disconnect the active transport (if any). */
export async function disconnect(): Promise<void> {
  const { transport } = getState();
  if (!transport) return;
  await transport.disconnect().catch(() => {});
  runnerSetTransport(null);
  storeSetTransport(null);
}

/** Emergency stop through the active transport, if connected. */
export async function estop(): Promise<void> {
  const { transport } = getState();
  if (transport) {
    await transport.estop().catch((err) => console.warn('estop failed', err));
  }
}
