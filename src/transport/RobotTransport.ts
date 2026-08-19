// src/transport/RobotTransport.ts
//
// The transport port (hexagonal architecture). UI and app code depend ONLY on
// this interface — never on the concrete BLE/Serial implementations.

import type { RobotCommand, RobotInfo } from '../domain/protocol';

export type { RobotInfo } from '../domain/protocol';

export type ConnState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RobotTransport {
  readonly kind: 'ble' | 'serial';

  /** Open the device picker, connect, run the HELLO handshake, resolve board info. */
  connect(): Promise<RobotInfo>;

  /** Cleanly close the connection and stop the heartbeat. */
  disconnect(): Promise<void>;

  /** Send one `{...};` command line (`;` appended if missing). */
  sendLine(line: string): Promise<void>;

  /** Send a whole program, respecting flow control. */
  sendProgram(lines: string[]): Promise<void>;

  /** Subscribe to parsed notify/telemetry frames from the board. */
  onTelemetry(cb: (msg: RobotCommand) => void): void;

  /** Subscribe to connection-state changes. */
  onState(cb: (s: ConnState) => void): void;

  /** Immediate DRIVE_DIRECT 0,0 + ESTOP, bypassing any queue. */
  estop(): Promise<void>;
}
