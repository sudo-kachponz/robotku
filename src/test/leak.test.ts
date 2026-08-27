// src/test/leak.test.ts
//
// R3 leak regressions we CAN prove headlessly: a run must not leave compiled
// condition Functions, sleep wakers, or scope behind. Deliberately breaking the
// cleanup (e.g. removing `this.compileCache.clear()` in ProgramRunner's finally)
// makes these fail — so a leak can't regress silently.

import { describe, it, expect } from 'vitest';
import { buildAndRun, startRun, type BlockSpec } from './harness';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A program whose `if` condition forces the runner to compile a Function.
const conditionalForward: BlockSpec[] = [
  {
    type: 'controls_if',
    inputs: { IF0: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: 5, B: 3 } } },
    statements: {
      DO0: [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.1 } }],
    },
  },
];

describe('R3: ProgramRunner leaves nothing behind', () => {
  it('clears the compiled-expression cache, wakers and scope after a completed run', async () => {
    const { runner } = await buildAndRun(conditionalForward, { speed: 8 });
    expect((runner as any).compileCache.size).toBe(0);
    expect((runner as any).wakers.size).toBe(0);
    expect(Object.keys((runner as any).scope).length).toBe(0);
    expect(runner.isRunning).toBe(false);
  });

  it('clears everything after a forever program is stopped mid-flight', async () => {
    const run = startRun([{ type: 'controls_forever', statements: { DO: conditionalForward } }], {
      speed: 8,
    });
    await sleep(60);
    run.runner.stop();
    await run.done;
    expect((run.runner as any).compileCache.size).toBe(0);
    expect((run.runner as any).wakers.size).toBe(0);
  });

  it('re-running does not accumulate compiled Functions across runs', async () => {
    let runner;
    for (let i = 0; i < 5; i++) {
      ({ runner } = await buildAndRun(conditionalForward, { speed: 8 }));
      expect((runner as any).compileCache.size).toBe(0);
    }
  });
});
