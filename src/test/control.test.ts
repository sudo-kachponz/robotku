// src/test/control.test.ts
// Parity test suite for PROGRAM FLOW — loops & conditionals.
// (Timing's Wait blocks live in timing.test.ts.)

import { describe, it, expect } from 'vitest';
import { buildAndRun, buildAndStart } from './harness';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const beeps = (log: any[]) => log.filter((c) => c.command === 'PLAY_SOUND_EFFECT');
const effects = (log: any[]) => beeps(log).map((c) => c.params.effect);

/** A short-beep body block, tagged with an EFFECT so branches are distinguishable. */
const beep = (effect = 'short_beep') => ({ type: 'audio_sound_effect', fields: { EFFECT: effect } });

describe('Parity: Program Flow', () => {
  it('controls_repeat_ext repeats the body exactly N times', async () => {
    const { log } = await buildAndRun([
      { type: 'controls_repeat_ext', inputs: { TIMES: 3 }, statements: { DO: [beep()] } },
    ]);
    expect(beeps(log).length).toBe(3);
  });

  it('controls_forever loops until stop() halts it', async () => {
    const run = buildAndStart([
      { type: 'controls_forever', statements: { DO: [beep()] } },
    ]);
    await sleep(120);
    const midway = beeps(run.log).length;
    run.runner.stop();
    await run.done;
    const afterStop = beeps(run.log).length;

    expect(midway).toBeGreaterThan(1); // it really iterated
    // No more beeps arrive once stopped (allow at most the one in flight).
    await sleep(40);
    expect(beeps(run.log).length - afterStop).toBeLessThanOrEqual(1);
    expect(run.runner.isRunning).toBe(false);
  });

  it('controls_while runs while the condition holds, then exits', async () => {
    // set n=0; while n < 3 { n = n + 1; beep } → exactly 3 beeps, then terminates.
    const { log } = await buildAndRun([
      { type: 'variables_set', fields: { VAR: 'n' }, inputs: { VALUE: 0 } },
      {
        type: 'controls_while',
        inputs: {
          CONDITION: {
            type: 'logic_compare',
            fields: { OP: 'LT' },
            inputs: { A: { type: 'variables_get', fields: { VAR: 'n' } }, B: 3 },
          },
        },
        statements: {
          DO: [
            {
              type: 'variables_set',
              fields: { VAR: 'n' },
              inputs: {
                VALUE: {
                  type: 'math_arithmetic',
                  fields: { OP: 'ADD' },
                  inputs: { A: { type: 'variables_get', fields: { VAR: 'n' } }, B: 1 },
                },
              },
            },
            beep(),
          ],
        },
      },
    ]);
    expect(beeps(log).length).toBe(3);
  });

  it('controls_break exits the loop early', async () => {
    // forever { beep; break } → body runs once, then the program terminates.
    const { log } = await buildAndRun([
      { type: 'controls_forever', statements: { DO: [beep(), { type: 'controls_break' }] } },
    ]);
    expect(beeps(log).length).toBe(1);
  });

  it('controls_continue skips the rest of the iteration', async () => {
    // repeat 3 { continue; beep } → the beep after continue never runs.
    const { log } = await buildAndRun([
      {
        type: 'controls_repeat_ext',
        inputs: { TIMES: 3 },
        statements: { DO: [{ type: 'controls_continue' }, beep()] },
      },
    ]);
    expect(beeps(log).length).toBe(0);
  });

  it('controls_if / else-if / else runs EXACTLY one branch', async () => {
    const program = (a: boolean, b: boolean) => [
      {
        type: 'controls_if',
        extraState: { elseIfCount: 1, hasElse: true },
        inputs: {
          IF0: { type: 'logic_boolean', fields: { BOOL: a ? 'TRUE' : 'FALSE' } },
          IF1: { type: 'logic_boolean', fields: { BOOL: b ? 'TRUE' : 'FALSE' } },
        },
        statements: {
          DO0: [beep('chirp')],
          DO1: [beep('buzz')],
          ELSE: [beep('ding')],
        },
      },
    ];

    expect(effects((await buildAndRun(program(true, true) as any)).log)).toEqual(['chirp']);
    expect(effects((await buildAndRun(program(true, false) as any)).log)).toEqual(['chirp']);
    expect(effects((await buildAndRun(program(false, true) as any)).log)).toEqual(['buzz']);
    expect(effects((await buildAndRun(program(false, false) as any)).log)).toEqual(['ding']);
  });
});
