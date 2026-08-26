// src/test/logic.test.ts
// Parity test suite for LOGIC — tested inside an if-condition (the only place
// boolean expressions exist). A fired branch drives the robot Forward (y < 0).

import { describe, it, expect } from 'vitest';
import { buildAndRun, type BlockSpec } from './harness';

const forward: BlockSpec = { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } };
const bool = (v: boolean): BlockSpec => ({ type: 'logic_boolean', fields: { BOOL: v ? 'TRUE' : 'FALSE' } });

/** `if <cond> then Forward`. Returns true if the robot moved. */
async function moved(cond: BlockSpec): Promise<boolean> {
  const { state } = await buildAndRun([
    { type: 'controls_if', inputs: { IF0: cond }, statements: { DO0: [forward] } },
  ]);
  return state.y < 0;
}

describe('Parity: Logic', () => {
  it('logic_boolean drives the branch directly', async () => {
    expect(await moved(bool(true))).toBe(true);
    expect(await moved(bool(false))).toBe(false);
  });

  it('logic_negate inverts its operand', async () => {
    expect(await moved({ type: 'logic_negate', inputs: { BOOL: bool(false) } })).toBe(true);
    expect(await moved({ type: 'logic_negate', inputs: { BOOL: bool(true) } })).toBe(false);
  });

  it('logic_operation handles AND and OR', async () => {
    expect(await moved({ type: 'logic_operation', fields: { OP: 'AND' }, inputs: { A: bool(true), B: bool(true) } })).toBe(true);
    expect(await moved({ type: 'logic_operation', fields: { OP: 'AND' }, inputs: { A: bool(true), B: bool(false) } })).toBe(false);
    expect(await moved({ type: 'logic_operation', fields: { OP: 'OR' }, inputs: { A: bool(false), B: bool(true) } })).toBe(true);
    expect(await moved({ type: 'logic_operation', fields: { OP: 'OR' }, inputs: { A: bool(false), B: bool(false) } })).toBe(false);
  });

  it('logic_compare compares two numbers', async () => {
    expect(await moved({ type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: 5, B: 3 } })).toBe(true);
    expect(await moved({ type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: 3, B: 5 } })).toBe(false);
    expect(await moved({ type: 'logic_compare', fields: { OP: 'EQ' }, inputs: { A: 4, B: 4 } })).toBe(true);
  });
});
