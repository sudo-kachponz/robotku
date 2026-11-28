// src/components/modes/labIoSensors.ts
//
// Lab I/O sensor polling. Firmware TELEMETRY replies carry the sensor name but NOT
// the port, so G1..G6 reads are only attributable with one request in flight at a
// time: readSensor() sends one GET_SENSOR_DATA and waits for its reply.

import { encodeCommand } from '../../domain/protocol';

export type SensorReq = { sensor: string; port?: string };
/** number = value, null = board has no such sensor (UNSUPPORTED), undefined = no answer. */
export type SensorReply = number | null | undefined;
type Frame = { command?: string; sensor?: string; value?: unknown; op?: string };

export const sensorKey = (r: SensorReq): string => (r.port ? `${r.sensor}:${r.port}` : r.sensor);

export const AUX_PORTS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const;
/** Read every cycle (touch and mic must feel live). */
export const FAST: SensorReq[] = [{ sensor: 'button1' }, { sensor: 'mic_level' }, { sensor: 'mic_clap' }];
/** Round-robin, SLOW_PER_CYCLE per cycle. */
export const SLOW: SensorReq[] = [
  { sensor: 'ultrasonic' },
  ...AUX_PORTS.map((port) => ({ sensor: 'analog', port })),
  ...AUX_PORTS.map((port) => ({ sensor: 'digital', port })),
];
export const SLOW_PER_CYCLE = 3;
export const CYCLE_MS = 250; // 4x/s

export function makeSensorReader(
  send: (line: string) => Promise<void>,
  subscribe: (cb: (m: Frame) => void) => () => void,
  timeoutMs = 800,
): (req: SensorReq) => Promise<SensorReply> {
  return (req) =>
    new Promise<SensorReply>((resolve) => {
      let finished = false;
      const done = (v: SensorReply) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        off();
        resolve(v);
      };
      const off = subscribe((m) => {
        if (m?.command === 'TELEMETRY' && m.sensor === req.sensor) done(Number(m.value));
        else if (m?.command === 'UNSUPPORTED' && m.op === 'GET_SENSOR_DATA') done(null);
      });
      const timer = setTimeout(() => done(undefined), timeoutMs);
      const params: Record<string, string> = { sensor: req.sensor };
      if (req.port) params.port = req.port;
      send(encodeCommand({ command: 'GET_SENSOR_DATA', params })).catch(() => done(undefined));
    });
}

/** The requests for cycle n: all FAST plus the next SLOW_PER_CYCLE of SLOW. */
export function cycleBatch(n: number): SensorReq[] {
  const slow = Array.from({ length: SLOW_PER_CYCLE }, (_, i) => SLOW[(n * SLOW_PER_CYCLE + i) % SLOW.length]);
  return [...FAST, ...slow];
}
