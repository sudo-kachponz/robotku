// src/test/integration.test.ts
// Cross-cutting guarantees for the whole runtime, beyond per-block parity:
//  1. Wire parity   — generateProgram() output matches a committed fixture.
//  2. Transport parity — every line a real board would receive is clean JSON.
//  3. Stop latency  — a forever program halts promptly.
//  4. No leak       — repeated run/stop never accumulates listeners/timers.

import { describe, it, expect, vi } from 'vitest';
import { buildProgram, buildAndStart, stripBids, type BlockSpec } from './harness';
import { ProgramRunner, type RobotSink } from '../runtime/ProgramRunner';
import { SimSink } from '../runtime/SimSink';

// estop() reaches into the connection store; stub it so a TransportSink can run headless.
vi.mock('../app/connection', () => ({ estop: async () => {} }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A fixed sample program exercising variables ($expr), a loop, and a conditional.
const SAMPLE: BlockSpec[] = [
  { type: 'variables_set', fields: { VAR: 'sec' }, inputs: { VALUE: 0.5 } },
  {
    type: 'controls_repeat_ext',
    inputs: { TIMES: 2 },
    statements: {
      DO: [
        {
          type: 'move_forward',
          fields: { SPEED: 'medium', LEFT: 'M1', RIGHT: 'M2' },
          inputs: { DURATION: { type: 'variables_get', fields: { VAR: 'sec' } } },
        },
        {
          type: 'controls_if',
          inputs: { IF0: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: 2, B: 1 } } },
          statements: { DO0: [{ type: 'audio_sound_effect', fields: { EFFECT: 'ding', WAIT: 'false' } }] },
        },
      ],
    },
  },
];

// Committed snapshot (block ids stripped). Regenerating this by hand should be a
// deliberate act — a diff here means the generator changed.
const WIRE_FIXTURE = [
  { command: 'META_SET_VAR', params: { name: 'sec', value: 0.5 } },
  { command: 'META_START_LOOP', params: { times: 2 } },
  { command: 'MOVE_TIMED', params: { direction: 'forward', speed: 70, duration_ms: { $expr: '(sec)*1000' }, left: 'M1', right: 'M2' } },
  { command: 'META_IF', params: { condition: '2 > 1' } },
  { command: 'PLAY_SOUND_EFFECT', params: { effect: 'ding', wait: false } },
  { command: 'META_END_IF', params: {} },
  { command: 'META_END_LOOP', params: {} },
];

describe('Integration: wire parity', () => {
  it('generateProgram() matches the committed fixture', () => {
    expect(stripBids(buildProgram(SAMPLE))).toEqual(WIRE_FIXTURE);
  });

  it('every generated command carries a _bid block id for editor glow', () => {
    const cmds = buildProgram(SAMPLE);
    for (const c of cmds) expect(typeof c.params._bid).toBe('string');
  });
});

describe('Integration: TransportSink parity', () => {
  it('emits only clean JSON lines — no _bid, no $expr, each ;-terminated', async () => {
    const { TransportSink } = await import('../runtime/TransportSink');
    const lines: string[] = [];
    const fakeTransport = {
      sendLine: (line: string) => lines.push(line),
    } as any;

    const sink = new TransportSink(fakeTransport);
    const runner = new ProgramRunner(sink);
    await runner.run(buildProgram(SAMPLE));

    // The board only ever sees the leaf device commands, never META_* control flow.
    const deviceLines = lines.filter((l) => l.includes('"command"'));
    expect(deviceLines.length).toBeGreaterThan(0);
    for (const line of deviceLines) {
      expect(line.endsWith(';')).toBe(true);
      expect(line).not.toContain('_bid');
      expect(line).not.toContain('$expr');
      const parsed = JSON.parse(line.slice(0, -1)); // valid JSON without the ';'
      expect(parsed.command).toBeTruthy();
    }

    // The $expr duration resolved to a real number before hitting the wire.
    const move = deviceLines.map((l) => JSON.parse(l.slice(0, -1))).find((c) => c.command === 'MOVE_TIMED');
    expect(move.params.duration_ms).toBe(500);
  });
});

describe('Integration: stop latency', () => {
  it('a forever program halts within 150 ms of stop()', async () => {
    const run = buildAndStart([
      { type: 'controls_forever', statements: { DO: [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } }] } },
    ]);
    await sleep(80); // let it get going (mid-drive)
    const t0 = performance.now();
    run.runner.stop();
    await run.done;
    expect(performance.now() - t0).toBeLessThan(150);
    expect(run.runner.isRunning).toBe(false);
  });
});

describe('Integration: no leak', () => {
  it('50 run/stop cycles keep sink listeners and runner timers at baseline', async () => {
    const sink = new SimSink();
    const unsub = sink.subscribe(() => {});
    const baseline = (sink as any).listeners.size; // 1
    const log: any[] = [];
    const wrapped: RobotSink = {
      exec: (c) => { log.push(c); return sink.exec(c); },
      getSensorValue: (j) => sink.getSensorValue(j),
      stopAll: () => sink.stopAll(),
    };
    const cmds = buildProgram([
      { type: 'controls_forever', statements: { DO: [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } }] } },
    ]);

    for (let i = 0; i < 50; i++) {
      const runner = new ProgramRunner(wrapped);
      runner.setSpeed(4);
      const done = runner.run(cmds);
      await new Promise((r) => setTimeout(r, 2));
      runner.stop();
      await done;
      // A stopped runner leaves no pending sleep wakers behind.
      expect((runner as any).wakers.size).toBe(0);
    }

    expect((sink as any).listeners.size).toBe(baseline); // no listener accumulation
    unsub();
    expect((sink as any).listeners.size).toBe(0);
  });
});
