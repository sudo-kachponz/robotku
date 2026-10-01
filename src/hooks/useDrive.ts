// src/hooks/useDrive.ts
//
// Shared live-drive helper for every control mode (Base, Port, Tank, Joystick).
// Reads the ONE shared transport from the store and the effective RobotSettings,
// then translates UI intent → SET_PORT (with per-port speed/invert applied) or
// DRIVE_DIRECT. If disconnected, every call is a safe no-op.

import { useCallback, useSyncExternalStore } from 'react';
import { getState } from '../app/store';
import { getSettings, subscribeSettings } from '../app/settingsStore';
import { applyPortTuning, type RobotSettings } from '../domain/settings';
import { setPortLine, driveDirectLine, encodeCommand, OPCODES } from '../domain/protocol';

function sendLine(line: string): Promise<void> {
  const { transport } = getState();
  if (!transport) return Promise.resolve();
  return transport.sendLine(line).catch((err) => console.warn('[drive] send failed', err));
}

// --- Live-drive coalescer (servo.md §5) -------------------------------------
// Pointer/joystick events fire at 60-240 Hz, but BLE drains far slower. Sending
// every event floods the write chain so commands pile up stale and the congested
// link eventually drops (the "joystick/OLED bikin disconnect" symptom). SET_PORT
// and DRIVE_DIRECT are idempotent — only the LATEST value matters — so we keep
// just the newest value per target and flush at most every DRIVE_MIN_INTERVAL_MS
// (latest-wins; intermediate stick positions are dropped on purpose). This caps
// the wire at ~20 Hz regardless of how fast the UI moves. One-shot commands
// (LED, tone, bitmap) and the program runner do NOT go through here.
const DRIVE_MIN_INTERVAL_MS = 50; // 20 Hz — smooth to a human, safe for BLE
const pendingPort = new Map<number, number>(); // port -> latest tuned value
let pendingDirect: [number, number] | null = null; // latest driveDirect(l,r)
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlush = 0;

function flushDrive(): void {
  flushTimer = null;
  lastFlush = Date.now();
  for (const [port, value] of pendingPort) sendLine(setPortLine(port, value));
  pendingPort.clear();
  if (pendingDirect) {
    sendLine(driveDirectLine(pendingDirect[0], pendingDirect[1]));
    pendingDirect = null;
  }
}

function scheduleFlush(): void {
  if (flushTimer) return; // a flush is already pending; the latest value will ride it
  const wait = Math.max(0, DRIVE_MIN_INTERVAL_MS - (Date.now() - lastFlush));
  flushTimer = setTimeout(flushDrive, wait);
}

// Exported for the coalescer unit test (not part of the hook API). Call sites
// should use the DriveApi from useDrive().
export function queuePort(port: number, value: number): void {
  pendingPort.set(port, value);
  scheduleFlush();
}

export function queueDirect(left: number, right: number): void {
  pendingDirect = [left, right];
  scheduleFlush();
}

/** Test-only: clear module-level coalescer state between cases. */
export function __resetDriveCoalescer(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  lastFlush = 0;
  pendingPort.clear();
  pendingDirect = null;
}

export const __DRIVE_MIN_INTERVAL_MS = DRIVE_MIN_INTERVAL_MS;

export function useSettings(): RobotSettings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export interface DriveApi {
  /** Drive a single port (raw -100..100 intent; tuning applied here). */
  setPort: (port: number, value: number) => void;
  /** Drive every port in a group to the same tuned value. */
  driveGroup: (ports: number[], value: number) => void;
  /** Convenience wheel drive (firmware maps to configured wheel ports). */
  driveDirect: (left: number, right: number) => void;
  /** Open/close the gripper. */
  setGripper: (open: boolean) => void;
  /** Set an RGB LED colour. */
  setLed: (color: string) => void;
  /** Zero a group of ports. */
  stopGroup: (ports: number[]) => void;
  /**
   * Send an arbitrary command to the board (e.g. DISPLAY_BITMAP). No-op if offline.
   * Resolves when the write has drained — await it to pace a stream (OLED frames).
   */
  sendCommand: (command: string, params?: Record<string, unknown>) => Promise<void>;
}

export function useDrive(): DriveApi {
  const settings = useSettings();

  const setPort = useCallback(
    (port: number, value: number) => {
      const tuned = applyPortTuning(value, settings.ports[port]);
      queuePort(port, tuned); // coalesced to ~20 Hz — see DRIVE_MIN_INTERVAL_MS
    },
    [settings],
  );

  const driveGroup = useCallback(
    (ports: number[], value: number) => {
      for (const p of ports) setPort(p, value);
    },
    [setPort],
  );

  const stopGroup = useCallback((ports: number[]) => {
    for (const p of ports) queuePort(p, 0);
  }, []);

  const driveDirect = useCallback((left: number, right: number) => {
    queueDirect(left, right);
  }, []);

  const setGripper = useCallback((open: boolean) => {
    sendLine(encodeCommand({ command: OPCODES.setGripper, state: open ? 'open' : 'closed' }));
  }, []);

  const setLed = useCallback((color: string) => {
    sendLine(encodeCommand({ command: OPCODES.setLedColor, color }));
  }, []);

  const sendCommand = useCallback((command: string, params: Record<string, unknown> = {}) => {
    // Nest under `params` — the SAME shape the Block Coding runner (TransportSink)
    // sends and the firmware's LED/bitmap/tone handlers read (doc["params"]["…"]).
    // Spreading flat put r/g/b/pixels at the top level, so a board that reads only
    // the nested form saw empty params: LED stayed off and the OLED image never drew.
    return sendLine(encodeCommand({ command, params } as Parameters<typeof encodeCommand>[0]));
  }, []);

  return { setPort, driveGroup, driveDirect, setGripper, setLed, stopGroup, sendCommand };
}
