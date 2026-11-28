// Lab I/O: the page copy per connection state, and the one-in-flight sensor reader
// (TELEMETRY replies carry no port, so G1..G6 only resolve by request order).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LabIo } from '../components/modes/PortMode';
import { makeSensorReader, cycleBatch, SLOW, FAST, SLOW_PER_CYCLE } from '../components/modes/labIoSensors';
import { setActiveTransport, setConnState } from '../app/store';
import type { RobotTransport } from '../transport';

const render = () => renderToStaticMarkup(createElement(LabIo));

afterEach(() => {
  setActiveTransport(null);
  setConnState('disconnected');
});

describe('Lab I/O page', () => {
  it('not connected: asks to connect, still shows all three cards with the copy', () => {
    const html = render();
    expect(html).toContain('Lab I/O');
    expect(html).toContain('Coba setiap bagian robot satu per satu — tanpa coding.');
    expect(html).toContain('Sambungkan robot dulu untuk mencoba Lab I/O.');
    expect(html).toContain('Gerakkan servo');
    expect(html).toContain('Roda kiri');
    expect(html).toContain('Roda kanan');
    expect(html).toContain('Servo tambahan');
    expect(html).not.toContain('aria-label="P3'); // no slider for a port the board lacks
    expect(html).toContain('Baca sensor');
    expect(html).toContain('Sentuh pad TOUCH 1 di board');
    expect(html).toContain('Nyalakan output');
    expect(html).toContain('Pilih lampu 1–4 lalu warnanya');
  });

  it('connected: no connect notice', () => {
    setActiveTransport({ kind: 'ble', sendLine: () => Promise.resolve() } as unknown as RobotTransport);
    setConnState('connected');
    expect(render()).not.toContain('Sambungkan robot dulu');
  });
});

describe('Lab I/O sensor reader', () => {
  const bus = () => {
    const subs = new Set<(m: object) => void>();
    return {
      subscribe: (cb: (m: object) => void) => (subs.add(cb), () => subs.delete(cb)),
      emit: (m: object) => subs.forEach((cb) => cb(m)),
      count: () => subs.size,
    };
  };

  it('sends one GET_SENSOR_DATA with the port and resolves on its TELEMETRY', async () => {
    const b = bus();
    const sent: string[] = [];
    const read = makeSensorReader(async (l) => void sent.push(l), b.subscribe);
    const p = read({ sensor: 'analog', port: 'G3' });
    expect(sent).toEqual(['{"command":"GET_SENSOR_DATA","params":{"sensor":"analog","port":"G3"}};']);
    b.emit({ command: 'TELEMETRY', sensor: 'mic_level', value: 9 }); // other sensor: ignored
    b.emit({ command: 'TELEMETRY', sensor: 'analog', value: 1234 });
    expect(await p).toBe(1234);
    expect(b.count()).toBe(0); // unsubscribed
  });

  it('UNSUPPORTED → null, silence → undefined after the timeout', async () => {
    const b = bus();
    const read = makeSensorReader(async () => {}, b.subscribe, 20);
    const p = read({ sensor: 'ultrasonic' });
    b.emit({ command: 'UNSUPPORTED', op: 'GET_SENSOR_DATA' });
    expect(await p).toBeNull();
    vi.useFakeTimers();
    const q = read({ sensor: 'button1' });
    vi.advanceTimersByTime(25);
    expect(await q).toBeUndefined();
    vi.useRealTimers();
  });

  it('every cycle reads all fast sensors; the slow list is covered round-robin', () => {
    const cycles = Math.ceil(SLOW.length / SLOW_PER_CYCLE);
    const slowSeen = new Set<string>();
    for (let n = 0; n < cycles; n++) {
      const batch = cycleBatch(n);
      expect(batch.slice(0, FAST.length)).toEqual(FAST);
      batch.slice(FAST.length).forEach((r) => slowSeen.add(`${r.sensor}:${r.port ?? ''}`));
    }
    expect(slowSeen.size).toBe(SLOW.length);
  });
});
