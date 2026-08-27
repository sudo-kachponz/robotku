// src/command_runner.ts
//
// The single choke-point for "Run". No Flutter bridge — it talks to a
// RobotTransport when one is connected, and otherwise falls back to the offline
// simulator so Run always does something.

import type { RobotTransport } from './transport';
import { normalizeProgram } from './domain/protocol';

let activeTransport: RobotTransport | null = null;

/** Callback used to run the program in the offline simulator when disconnected. */
type SimulatorRunner = (commands: any[]) => void;
let simulatorRunner: SimulatorRunner | null = null;

/** Registered by the app once a transport connects (null on disconnect). */
export function setActiveTransport(t: RobotTransport | null): void {
  activeTransport = t;
}

/** Registered by main.ts so we can simulate when no device is connected. */
export function setSimulatorRunner(runner: SimulatorRunner | null): void {
  simulatorRunner = runner;
}

/**
 * Run a program. `commandJson` is whatever window.generateCodeForExecution()
 * produced (a JSON array string) or a `;`-delimited blob.
 *   - transport connected -> stream the lines to the firmware interpreter
 *   - otherwise           -> run the offline simulator
 */
export function runCommandsOnRobot(commandJson: string): void {
  const lines = normalizeProgram(commandJson);

  if (activeTransport) {
    activeTransport.sendProgram(lines).catch((err) => {
      console.error('[run] sendProgram failed', err);
    });
    return;
  }

  if (simulatorRunner) {
    try {
      const commands = JSON.parse(commandJson);
      simulatorRunner(Array.isArray(commands) ? commands : []);
    } catch (err) {
      console.error('[run] failed to parse commands for simulator', err);
    }
  } else {
    console.warn('[run] no simulator runner registered');
  }
}
