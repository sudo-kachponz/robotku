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

function sendLine(line: string): void {
  const { transport } = getState();
  if (!transport) return;
  transport.sendLine(line).catch((err) => console.warn('[drive] send failed', err));
}

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
}

export function useDrive(): DriveApi {
  const settings = useSettings();

  const setPort = useCallback(
    (port: number, value: number) => {
      const tuned = applyPortTuning(value, settings.ports[port]);
      sendLine(setPortLine(port, tuned));
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
    for (const p of ports) sendLine(setPortLine(p, 0));
  }, []);

  const driveDirect = useCallback((left: number, right: number) => {
    sendLine(driveDirectLine(left, right));
  }, []);

  const setGripper = useCallback((open: boolean) => {
    sendLine(encodeCommand({ command: OPCODES.setGripper, state: open ? 'open' : 'closed' }));
  }, []);

  const setLed = useCallback((color: string) => {
    sendLine(encodeCommand({ command: OPCODES.setLedColor, color }));
  }, []);

  return { setPort, driveGroup, driveDirect, setGripper, setLed, stopGroup };
}
