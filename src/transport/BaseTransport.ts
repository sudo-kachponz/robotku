// src/transport/BaseTransport.ts
//
// Shared behaviour for every concrete transport (BLE, Serial):
//   - HELLO handshake with 4s timeout
//   - 500ms HEARTBEAT + 1.5s watchdog -> 'error' + auto e-stop
//   - outgoing chunking to <=180 bytes, never splitting a `;`-terminated command
//     across writes when it fits
//   - inbound framing: buffer until `;`/newline, JSON.parse, forward as telemetry
//
// Subclasses only implement the wire-level open/close/write; all protocol logic
// lives here so BLE and Serial stay identical.

import type { ConnState, RobotTransport } from './RobotTransport';
import {
  type RobotCommand,
  type RobotInfo,
  heartbeatLine,
  helloLine,
  estopLines,
  parseTelemetry,
} from '../domain/protocol';

const MAX_CHUNK = 180; // bytes per BLE write (safe for default ATT MTU)
const HELLO_TIMEOUT_MS = 4000;
const HEARTBEAT_INTERVAL_MS = 500;
const HEARTBEAT_TIMEOUT_MS = 1500;

export abstract class BaseTransport implements RobotTransport {
  abstract readonly kind: 'ble' | 'serial';

  private telemetryCbs: Array<(msg: RobotCommand) => void> = [];
  private stateCbs: Array<(s: ConnState) => void> = [];
  private state: ConnState = 'disconnected';

  private rxBuffer = '';
  private encoder = new TextEncoder();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatSeq = 0;
  private lastRxTime = 0;

  private helloResolve: ((info: RobotInfo) => void) | null = null;

  // ---- subclass contract -------------------------------------------------

  /** Open the picker + device, wire notifications to `this.handleIncoming`. */
  protected abstract openTransport(): Promise<void>;

  /** Tear down the underlying device/port. */
  protected abstract closeTransport(): Promise<void>;

  /** Write raw bytes to the board (already chunked to <=180 bytes). */
  protected abstract writeChunk(bytes: Uint8Array): Promise<void>;

  // ---- lifecycle ---------------------------------------------------------

  async connect(): Promise<RobotInfo> {
    this.setState('connecting');
    try {
      await this.openTransport();
    } catch (err) {
      this.setState('disconnected'); // user cancelled picker / no device
      throw err;
    }

    try {
      const info = await this.handshake();
      this.lastRxTime = Date.now();
      this.startHeartbeat();
      this.setState('connected');
      return info;
    } catch (err) {
      await this.closeTransport().catch(() => {});
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    await this.closeTransport().catch(() => {});
    this.setState('disconnected');
  }

  // ---- sending -----------------------------------------------------------

  async sendLine(line: string): Promise<void> {
    const normalized = line.trim().endsWith(';') ? line.trim() : `${line.trim()};`;
    await this.writeFramed(normalized);
  }

  async sendProgram(lines: string[]): Promise<void> {
    for (const line of lines) {
      await this.sendLine(line);
    }
  }

  async estop(): Promise<void> {
    // Bypass every queue: write straight to the wire, immediately.
    try {
      await this.writeFramed(estopLines());
    } catch (err) {
      console.warn('[transport] estop write failed', err);
    }
  }

  // ---- subscriptions -----------------------------------------------------

  onTelemetry(cb: (msg: RobotCommand) => void): void {
    this.telemetryCbs.push(cb);
  }

  onState(cb: (s: ConnState) => void): void {
    this.stateCbs.push(cb);
  }

  // ---- inbound (called by subclasses) ------------------------------------

  /** Feed raw inbound text/bytes; frames are extracted on `;` / newline. */
  protected handleIncoming(text: string): void {
    this.lastRxTime = Date.now();
    this.rxBuffer += text;

    // Only process up to the last complete frame boundary.
    const lastBoundary = Math.max(this.rxBuffer.lastIndexOf(';'), this.rxBuffer.lastIndexOf('\n'));
    if (lastBoundary === -1) return;

    const complete = this.rxBuffer.slice(0, lastBoundary + 1);
    this.rxBuffer = this.rxBuffer.slice(lastBoundary + 1);

    for (const msg of parseTelemetry(complete)) {
      this.dispatch(msg);
    }
  }

  /** Called by subclasses when the underlying link drops unexpectedly. */
  protected handleUnexpectedDisconnect(): void {
    this.stopHeartbeat();
    this.setState('disconnected');
  }

  // ---- internals ---------------------------------------------------------

  private dispatch(msg: RobotCommand): void {
    const type = (msg.command as string) || (msg as any).event;

    if (type === 'HELLO_ACK' && this.helloResolve) {
      const info: RobotInfo = {
        fwVersion: String((msg as any).fw ?? (msg as any).fwVersion ?? '?'),
        board: String((msg as any).board ?? 'Robotku'),
        protocol: String((msg as any).protocol ?? 'robotku-v1'),
        capabilities: Array.isArray((msg as any).capabilities) ? (msg as any).capabilities : [],
      };
      this.helloResolve(info);
      this.helloResolve = null;
    }

    for (const cb of this.telemetryCbs) {
      try {
        cb(msg);
      } catch (err) {
        console.warn('[transport] telemetry callback threw', err);
      }
    }
  }

  private handshake(): Promise<RobotInfo> {
    return new Promise<RobotInfo>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.helloResolve = null;
        reject(new Error('HELLO handshake timed out (no HELLO_ACK within 4s)'));
      }, HELLO_TIMEOUT_MS);

      this.helloResolve = (info) => {
        clearTimeout(timer);
        resolve(info);
      };

      this.writeFramed(helloLine()).catch((err) => {
        clearTimeout(timer);
        this.helloResolve = null;
        reject(err);
      });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatSeq = 0;
    this.heartbeatTimer = setInterval(() => {
      // Watchdog: no inbound frame within the timeout window -> failsafe.
      if (Date.now() - this.lastRxTime > HEARTBEAT_TIMEOUT_MS) {
        console.warn('[transport] heartbeat watchdog tripped');
        this.setState('error');
        void this.estop();
        return;
      }
      void this.writeFramed(heartbeatLine(this.heartbeatSeq++)).catch(() => {
        this.setState('error');
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setState(s: ConnState): void {
    if (this.state === s) return;
    this.state = s;
    for (const cb of this.stateCbs) {
      try {
        cb(s);
      } catch (err) {
        console.warn('[transport] state callback threw', err);
      }
    }
  }

  /**
   * UTF-8 encode a `;`-terminated blob and write it in <=180-byte chunks,
   * splitting on `;` boundaries so a single command isn't torn across writes
   * when it fits in a chunk.
   */
  private async writeFramed(blob: string): Promise<void> {
    // Group commands so each chunk stays <=MAX_CHUNK and prefers `;` boundaries.
    const commands = blob
      .split(';')
      .filter((c) => c.length > 0)
      .map((c) => `${c};`);

    let batch = '';
    for (const cmd of commands) {
      const cmdBytes = this.encoder.encode(cmd);
      if (cmdBytes.length > MAX_CHUNK) {
        // Oversized single command: flush batch, then hard-split the command.
        if (batch) {
          await this.writeChunk(this.encoder.encode(batch));
          batch = '';
        }
        await this.writeRawChunks(cmdBytes);
        continue;
      }
      if (this.encoder.encode(batch + cmd).length > MAX_CHUNK) {
        await this.writeChunk(this.encoder.encode(batch));
        batch = cmd;
      } else {
        batch += cmd;
      }
    }
    if (batch) {
      await this.writeChunk(this.encoder.encode(batch));
    }
  }

  private async writeRawChunks(bytes: Uint8Array): Promise<void> {
    for (let i = 0; i < bytes.length; i += MAX_CHUNK) {
      await this.writeChunk(bytes.slice(i, i + MAX_CHUNK));
    }
  }
}
