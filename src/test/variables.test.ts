// src/test/variables.test.ts
// Parity test suite for VARIABLES — variables_set (number/string/boolean) and
// variables_get used both as a duration input and inside a condition.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun, type BlockSpec } from './harness';

const get = (name: string): BlockSpec => ({ type: 'variables_get', fields: { VAR: name } });
const forward = (duration: BlockSpec | number): BlockSpec => ({
  type: 'move_forward',
  fields: { SPEED: 'medium' },
  inputs: { DURATION: duration },
});

describe('Parity: Variables', () => {
  it('variables_set generates META_SET_VAR', () => {
    const cmds = buildBlock({
      type: 'variables_set',
      fields: { VAR: 'score' },
      inputs: { VALUE: 7 },
    });
    expect(cmds[0]).toMatchObject({ command: 'META_SET_VAR', params: { name: 'score', value: 7 } });
  });

  it('a numeric variable resolves inside a duration input', async () => {
    const { log } = await buildAndRun(
      [
        { type: 'variables_set', fields: { VAR: 'sec' }, inputs: { VALUE: 0.2 } },
        forward(get('sec')),
      ],
      { speed: 8 },
    );
    expect(log.find((c) => c.command === 'MOVE_TIMED')?.params?.duration_ms).toBeCloseTo(200, 0);
  });

  it('a numeric variable can be incremented from its own value', async () => {
    // score starts at 0 → score = score + 1 → if score == 1 then Forward.
    const { state } = await buildAndRun([
      {
        type: 'variables_set',
        fields: { VAR: 'score' },
        inputs: {
          VALUE: {
            type: 'math_arithmetic',
            fields: { OP: 'ADD' },
            inputs: { A: get('score'), B: 1 },
          },
        },
      },
      {
        type: 'controls_if',
        inputs: {
          IF0: { type: 'logic_compare', fields: { OP: 'EQ' }, inputs: { A: get('score'), B: 1 } },
        },
        statements: { DO0: [forward(0.2)] },
      },
    ]);
    expect(state.y).toBeLessThan(0);
  });

  it('a string variable resolves inside a condition', async () => {
    const program = (target: string): any[] => [
      { type: 'variables_set', fields: { VAR: 'greeting' }, inputs: { VALUE: 'go' } },
      {
        type: 'controls_if',
        inputs: {
          IF0: {
            type: 'logic_compare',
            fields: { OP: 'EQ' },
            inputs: { A: get('greeting'), B: target },
          },
        },
        statements: { DO0: [forward(0.2)] },
      },
    ];
    expect((await buildAndRun(program('go'))).state.y).toBeLessThan(0);
    expect((await buildAndRun(program('stop'))).state.y).toBe(0);
  });

  it('a boolean variable gates a condition', async () => {
    const program = (v: boolean): any[] => [
      {
        type: 'variables_set',
        fields: { VAR: 'flag' },
        inputs: { VALUE: { type: 'logic_boolean', fields: { BOOL: v ? 'TRUE' : 'FALSE' } } },
      },
      { type: 'controls_if', inputs: { IF0: get('flag') }, statements: { DO0: [forward(0.2)] } },
    ];
    expect((await buildAndRun(program(true))).state.y).toBeLessThan(0);
    expect((await buildAndRun(program(false))).state.y).toBe(0);
  });
});
