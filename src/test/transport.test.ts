// src/test/transport.test.ts
// Wire framing regression: every command the transport writes must end with ";\n".
//
// Firmware that reads with Serial.readStringUntil('\n') (the ControllerV1 sketch)
// hangs on a missing newline until its ~1s timeout and then tries to parse several
// concatenated commands as one string. Robotku's own feed() splits on ';' AND '\n',
// so the extra byte is harmless there — but it must be exactly one byte, and the
// ';' must not be doubled.

import { describe, it, expect } from 'vitest';
import { BaseTransport } from '../transport/BaseTransport';
import { driveDirectLine, setPortLine, estopLines } from '../domain/protocol';

/** Records every byte the transport hands to the wire. */
class FakeTransport extends BaseTransport {
  readonly kind = 'serial' as const;
  readonly chunks: string[] = [];
  private decoder = new TextDecoder();

  protected async openTransport(): Promise<void> {}
  protected async closeTransport(): Promise<void> {}
  protected async writeChunk(bytes: Uint8Array): Promise<void> {
    this.chunks.push(this.decoder.decode(bytes));
  }

  /** Everything written so far, as one string. */
  wire(): string {
    return this.chunks.join('');
  }

  /** The wire split back into lines, newline included. */
  lines(): string[] {
    return this.wire()
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => `${l}\n`);
  }
}

function assertWellFramed(t: FakeTransport): void {
  const wire = t.wire();
  expect(wire.length).toBeGreaterThan(0);
  expect(wire.endsWith(';\n')).toBe(true);
  expect(wire).not.toContain(';;'); // no doubled terminator
  expect(wire).not.toContain('\n\n'); // no blank lines
  expect(wire).not.toContain('\n;'); // no orphaned ';' after a newline
  for (const line of t.lines()) {
    expect(line.endsWith(';\n')).toBe(true);
    expect(line.slice(0, -2)).not.toContain('\n');
  }
}

describe('BaseTransport wire framing', () => {
  it('terminates a single command with ";\\n"', async () => {
    const t = new FakeTransport();
    await t.sendLine('{"command":"SET_PORT","port":1,"value":80}');
    expect(t.wire()).toBe('{"command":"SET_PORT","port":1,"value":80};\n');
    assertWellFramed(t);
  });

  it('does not double the ";" when the caller already terminated the line', async () => {
    const t = new FakeTransport();
    await t.sendLine(setPortLine(1, 80)); // protocol helper already appends ';'
    expect(t.wire()).toBe('{"command":"SET_PORT","port":1,"value":80};\n');
    assertWellFramed(t);
  });

  it('newline-terminates every command of a multi-command blob', async () => {
    const t = new FakeTransport();
    await t.sendLine(`${driveDirectLine(50, -50)}${setPortLine(2, 0)}`);
    expect(t.lines()).toEqual([
      '{"command":"DRIVE_DIRECT","left":50,"right":-50};\n',
      '{"command":"SET_PORT","port":2,"value":0};\n',
    ]);
    assertWellFramed(t);
  });

  it('newline-terminates every line of a program', async () => {
    const t = new FakeTransport();
    await t.sendProgram([
      '{"command":"MOVE_TIMED","params":{"direction":"forward","speed":60,"duration_ms":1000}}',
      '{"command":"STOP_ALL"};',
    ]);
    expect(t.lines()).toHaveLength(2);
    assertWellFramed(t);
  });

  it('newline-terminates the e-stop path (both commands)', async () => {
    const t = new FakeTransport();
    await t.estop();
    expect(t.lines()).toEqual([
      '{"command":"DRIVE_DIRECT","left":0,"right":0};\n',
      '{"command":"ESTOP"};\n',
    ]);
    // estopLines() itself must NOT already carry newlines, or we'd double them.
    expect(estopLines()).not.toContain('\n');
    assertWellFramed(t);
  });

  it('keeps chunks within the BLE-safe 180-byte budget once newlines are added', async () => {
    const t = new FakeTransport();
    const many = Array.from({ length: 20 }, (_, i) => setPortLine(1, i)).join('');
    await t.sendLine(many);
    for (const chunk of t.chunks) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(180);
    }
    expect(t.lines()).toHaveLength(20);
    assertWellFramed(t);
  });

  it('writes nothing for an empty or whitespace-only line', async () => {
    const t = new FakeTransport();
    await t.sendLine('   ');
    await t.sendLine('');
    expect(t.chunks).toEqual([]);
  });
});
