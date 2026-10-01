// src/test/driveCoalescer.test.ts
//
// Guards the anti-flood invariant (servo.md §5): a burst of live-drive updates
// must collapse to ONE write per ~50 ms window, carrying the LATEST value — so a
// joystick firing at 120-240 Hz can't flood BLE and drop the link.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  queuePort,
  queueDirect,
  __resetDriveCoalescer,
  __DRIVE_MIN_INTERVAL_MS as IVL,
} from '../hooks/useDrive';
import { setActiveTransport } from '../app/store';
import type { RobotTransport } from '../transport';

function mockTransport() {
  const sent: string[] = [];
  const t = {
    kind: 'ble',
    sendLine: (line: string) => {
      sent.push(line);
      return Promise.resolve();
    },
  } as unknown as RobotTransport;
  return { t, sent };
}

describe('live-drive coalescer (servo.md §5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetDriveCoalescer();
  });
  afterEach(() => {
    setActiveTransport(null);
    vi.useRealTimers();
  });

  it('collapses a 20-event burst to one write with the latest value', () => {
    const { t, sent } = mockTransport();
    setActiveTransport(t);

    for (let v = 1; v <= 20; v++) queuePort(1, v); // rapid stick drag
    expect(sent).toHaveLength(0); // nothing sent synchronously

    vi.advanceTimersByTime(IVL);
    expect(sent).toHaveLength(1); // exactly one write for the whole burst
    expect(sent[0]).toContain('"value":20'); // latest-wins, intermediates dropped
  });

  it('flushes every queued port together, then caps follow-ups at ~20 Hz', () => {
    const { t, sent } = mockTransport();
    setActiveTransport(t);

    queuePort(1, 50);
    queuePort(2, -50);
    vi.advanceTimersByTime(IVL);
    expect(sent).toHaveLength(2); // both ports in the one window

    // A second burst inside the next window again collapses to one write/port.
    for (let v = 0; v < 10; v++) queuePort(1, v);
    vi.advanceTimersByTime(IVL);
    expect(sent).toHaveLength(3);
    expect(sent[2]).toContain('"value":9');
  });

  it('coalesces driveDirect latest-wins', () => {
    const { t, sent } = mockTransport();
    setActiveTransport(t);

    queueDirect(10, 10);
    queueDirect(80, -80);
    vi.advanceTimersByTime(IVL);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('"left":80');
    expect(sent[0]).toContain('"right":-80');
  });
});
