// src/test/math.test.ts
// Parity test suite for MATH. Each math block is wired as a Forward DURATION and
// we assert the value the ProgramRunner RESOLVES at run time (captured in the exec
// log after $expr resolution). Values are kept tiny so the sim runs fast.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildAndRun, type BlockSpec } from './harness';

/** Resolved duration_ms of the (single) Forward command in a run. */
async function forwardDurationFrom(duration: BlockSpec | number): Promise<number> {
  const { log } = await buildAndRun(
    [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: duration } }],
    { speed: 8 },
  );
  return log.find((c) => c.command === 'MOVE_TIMED')?.params?.duration_ms;
}

const div = (a: BlockSpec, b: number): BlockSpec => ({
  type: 'math_arithmetic',
  fields: { OP: 'DIVIDE' },
  inputs: { A: a, B: b },
});

afterEach(() => vi.restoreAllMocks());

describe('Parity: Math', () => {
  it('math_number passes a constant through byte-identically', async () => {
    expect(await forwardDurationFrom({ type: 'math_number', fields: { NUM: 0.05 } })).toBe(50);
  });

  it('math_arithmetic evaluates ADD at run time', async () => {
    const sum: BlockSpec = { type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: { A: 0.03, B: 0.02 } };
    expect(await forwardDurationFrom(sum)).toBeCloseTo(50, 0);
  });

  it('math_modulo evaluates the remainder', async () => {
    const mod: BlockSpec = { type: 'math_modulo', inputs: { DIVIDEND: 0.55, DIVISOR: 0.1 } };
    expect(await forwardDurationFrom(mod)).toBeCloseTo(50, 0);
  });

  it('math_constant resolves PI', async () => {
    // PI / 100 * 1000 ≈ 31.4 ms
    expect(await forwardDurationFrom(div({ type: 'math_constant', fields: { CONSTANT: 'PI' } }, 100))).toBeCloseTo(31.4, 0);
  });

  it('math_single computes the square root', async () => {
    const root: BlockSpec = { type: 'math_single', fields: { OP: 'ROOT' }, inputs: { NUM: 0.0025 } };
    expect(await forwardDurationFrom(root)).toBeCloseTo(50, 0);
  });

  it('math_round rounds to the nearest integer', async () => {
    // round(3.1) = 3 → /100 * 1000 = 30 ms
    const rounded: BlockSpec = { type: 'math_round', fields: { OP: 'ROUND' }, inputs: { NUM: 3.1 } };
    expect(await forwardDurationFrom(div(rounded, 100))).toBeCloseTo(30, 0);
  });

  it('math_random_int is deterministic under a seeded Math.random and stays in range', async () => {
    // mathRandomInt(1,100) with Math.random()==0.5 → floor(0.5*100)+1 = 51.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const rnd: BlockSpec = { type: 'math_random_int', inputs: { FROM: 1, TO: 100 } };
    expect(await forwardDurationFrom(div(rnd, 1000))).toBeCloseTo(51, 0);
    vi.restoreAllMocks();

    // Unseeded: repeated draws always land inside [1, 100] (→ [1, 100] ms here).
    for (let i = 0; i < 10; i++) {
      const ms = await forwardDurationFrom(div(rnd, 1000));
      expect(ms).toBeGreaterThanOrEqual(1);
      expect(ms).toBeLessThanOrEqual(100);
    }
  });
});
