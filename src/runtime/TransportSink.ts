// src/runtime/TransportSink.ts
//
// A RobotSink backed by the REAL robot. Timed actions stream their command line
// and then wait locally for the duration; sensor reads return the LAST cached
// TELEMETRY value (synchronous by contract, so the condition sandbox never
// blocks). Used when a program is host-executed against a connected board
// (e.g. AI programs in PROMPT 2) or as the mirror target.

import type { RobotSink } from './ProgramRunner';
import type { RobotTransport } from '../transport';
import { encodeCommand } from '../domain/protocol';
import { estop } from '../app/connection';
import { getCachedSensor } from './telemetryCache';
import { cvStore } from '../ai/cvStore';

export class TransportSink implements RobotSink {
  private transport: RobotTransport;
  private stopRequested = false;
  private wakers = new Set<() => void>();

  constructor(transport: RobotTransport) {
    this.transport = transport;
  }

  async exec(cmd: { command: string; params: any }): Promise<void> {
    this.stopRequested = false;
    // AI camera commands are host-side — the board never runs a model.
    if (cmd.command === 'AI_CAMERA') {
      if (cmd.params?.on) void cvStore.startCamera();
      else cvStore.stop();
      return;
    }
    if (cmd.command === 'AI_SET_MODEL') {
      if (cmd.params?.model) void cvStore.setModel(String(cmd.params.model));
      return;
    }
    // Strip the editor-only highlight id so the firmware sees clean bytes.
    let params = cmd.params;
    if (params && typeof params === 'object' && '_bid' in params) {
      params = { ...params };
      delete params._bid;
    }
    try {
      this.transport.sendLine(encodeCommand({ command: cmd.command, params } as any));
    } catch (err) {
      console.warn('[TransportSink] sendLine failed', err);
    }
    const ms = durMs(cmd.params);
    if (ms > 0) await this.sleep(ms);
  }

  getSensorValue(getSensorDataJson: string): number | null {
    let sensor: string | undefined;
    let port: string | number | undefined;
    try {
      const parsed = JSON.parse(getSensorDataJson);
      // AI reporters resolve in the BROWSER (cvStore), never from the board.
      if (parsed?.command === 'GET_AI_DATA') return cvStore.getAiValue(parsed.params ?? {});
      sensor = parsed?.params?.sensor;
      port = parsed?.params?.port;
    } catch {
      return null;
    }
    if (!sensor) return null;
    // Ask the board to refresh this reading (fire-and-forget); return cache now.
    try {
      const line = getSensorDataJson.endsWith(';') ? getSensorDataJson : `${getSensorDataJson};`;
      this.transport.sendLine(line);
    } catch {
      /* ignore — cache still serves the last value */
    }
    return getCachedSensor(sensor, port ?? null);
  }

  stopAll(): void {
    this.stopRequested = true;
    for (const wake of this.wakers) wake();
    this.wakers.clear();
    void estop();
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

function durMs(params: any): number {
  if (params == null) return 0;
  if (typeof params.duration_ms === 'number') return params.duration_ms;
  if (typeof params.ms === 'number') return params.ms;
  if (typeof params.secs === 'number') return params.secs * 1000;
  return 0;
}
