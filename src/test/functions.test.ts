// src/test/functions.test.ts
// Parity test suite for FUNCTIONS — Define + Call + Exit (no value-returning
// functions, per the lms.md decision). A function definition lives on its own top
// stack; generateProgram() appends it so calls can resolve.

import { describe, it, expect } from 'vitest';
import { buildAndRun, type BlockSpec } from './harness';

const forward: BlockSpec = { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } };
const bool = (v: boolean): BlockSpec => ({ type: 'logic_boolean', fields: { BOOL: v ? 'TRUE' : 'FALSE' } });
const moves = (log: any[]) => log.filter((c) => c.command === 'MOVE_TIMED').length;

const define = (name: string, body: BlockSpec[]): BlockSpec => ({
  type: 'procedures_defnoreturn',
  fields: { NAME: name },
  statements: { STACK: body },
});
const call = (name: string): BlockSpec => ({ type: 'procedures_callnoreturn', fields: { NAME: name } });

describe('Parity: Functions', () => {
  it('define + call executes the body exactly once', async () => {
    const { state, log } = await buildAndRun([call('maju'), define('maju', [forward])]);
    expect(moves(log)).toBe(1);
    expect(state.y).toBeLessThan(0);
  });

  it('a call inside a loop runs the body N times', async () => {
    const { log } = await buildAndRun([
      { type: 'controls_repeat_ext', inputs: { TIMES: 3 }, statements: { DO: [call('maju')] } },
      define('maju', [forward]),
    ]);
    expect(moves(log)).toBe(3);
  });

  it('Exit (procedures_ifreturn) returns early, skipping the rest of the body', async () => {
    const buildProgram = (exit: boolean): any[] => [
      call('maybe'),
      define('maybe', [
        { type: 'procedures_ifreturn', inputs: { CONDITION: bool(exit) } },
        forward,
      ]),
    ];
    // Condition true → return before Forward → no motion.
    expect(moves((await buildAndRun(buildProgram(true))).log)).toBe(0);
    // Condition false → fall through → Forward runs.
    expect(moves((await buildAndRun(buildProgram(false))).log)).toBe(1);
  });
});
