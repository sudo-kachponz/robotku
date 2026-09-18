// src/test/python.parity.test.ts
//
// Phase 3 — the parity guard (C1): for each program,
//   blocks -> commands   ===deepEqual===   blocks -> python -> commands
// Both paths end in generateProgram(), so any drift fails loudly here.

import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { ensureInit } from './harness';
import { buildTemplateWorkspace, type BlockSpec } from '../templates/authoring';
import { generateProgram } from '../blockcoding/generateProgram';
import { generatePython } from '../pythongen';
import { compilePython, parsePython } from '../pythongen/compile';

// _bid (source block id) / _line (source line) are highlight pointers stamped per
// workspace, not semantics — strip them before comparing the two paths.
function stripMeta(cmds: unknown[]): unknown[] {
  return cmds.map((c) => {
    const cmd = c as { command?: string; params?: Record<string, unknown> };
    if (!cmd?.params) return cmd;
    const { _bid, _line, ...rest } = cmd.params;
    void _bid;
    void _line;
    return { ...cmd, params: rest };
  });
}

function blocksToCommands(program: BlockSpec[]): unknown[] {
  const json = buildTemplateWorkspace(program);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return stripMeta(generateProgram(ws));
  } finally {
    ws.dispose();
  }
}
function blocksToPython(program: BlockSpec[]): string {
  const json = buildTemplateWorkspace(program);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generatePython(ws);
  } finally {
    ws.dispose();
  }
}

const PROGRAMS: Record<string, BlockSpec[]> = {
  'movement + display in forever': [
    { type: 'controls_forever', statements: { DO: [
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 2 } },
      { type: 'move_right', fields: { SPEED: 'fast' }, inputs: { DURATION: 1 } },
      { type: 'display_text', fields: { TEXT: 'Hi!' } },
      { type: 'move_stop', fields: { WHEELS: '2' } },
    ] } },
  ],
  'repeat + wait + servo + melody expansion': [
    { type: 'controls_repeat_ext', inputs: { TIMES: 3 }, statements: { DO: [
      { type: 'timing_wait', inputs: { DURATION: 1 } },
      { type: 'servo_single', fields: { PORT: 'P1', SPEED: '100' }, inputs: { DURATION: 2 } },
      { type: 'audio_play_melody', fields: { SONG: 'twinkle' } },
    ] } },
  ],
  'if / elif / else with sensor + compare': [
    { type: 'controls_if', extraState: { elseIfCount: 1, hasElse: true },
      inputs: {
        IF0: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: { type: 'sensor_distance', fields: { PORT: 'G1' } }, B: 20 } },
        IF1: { type: 'sensor_button1' },
      },
      statements: {
        DO0: [{ type: 'display_text', fields: { TEXT: 'far' } }],
        DO1: [{ type: 'display_text', fields: { TEXT: 'btn' } }],
        ELSE: [{ type: 'move_stop_all' }],
      } },
  ],
  'variable set + expression duration': [
    { type: 'variables_set', fields: { VAR: 'n' }, inputs: { VALUE: 3 } },
    { type: 'move_forward', fields: { SPEED: 'slow' },
      inputs: { DURATION: { type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: { A: { type: 'variables_get', fields: { VAR: 'n' } }, B: 1 } } } },
  ],
  'while sensor + led hex': [
    { type: 'controls_while', inputs: { CONDITION: { type: 'sensor_button2' } }, statements: { DO: [
      { type: 'set_led_color', fields: { COLOR: '#00ff00' }, inputs: { DURATION: 1 } },
      { type: 'controls_break' },
    ] } },
  ],
  'function def + call': [
    { type: 'procedures_defnoreturn', fields: { NAME: 'maju' }, statements: { STACK: [
      { type: 'move_forward', fields: { SPEED: 'fast' }, inputs: { DURATION: 1 } },
    ] } },
    { type: 'procedures_callnoreturn', fields: { NAME: 'maju' } },
  ],
};

describe('Python parity: blocks -> commands === blocks -> python -> commands', () => {
  for (const [name, program] of Object.entries(PROGRAMS)) {
    it(name, () => {
      ensureInit();
      const fromBlocks = blocksToCommands(program);
      const py = blocksToPython(program);
      const fromPython = stripMeta(compilePython(py));
      expect(fromPython).toEqual(fromBlocks);
    });
  }

  it('parsePython rebuilds an equivalent program (Python -> Blocks path)', () => {
    ensureInit();
    const src = 'while True:\n    robot.forward(2, speed="medium")\n    wait(1)\n';
    const specs = parsePython(src);
    const viaParsed = blocksToCommands(specs);
    const viaBlocks = blocksToCommands([
      { type: 'controls_forever', statements: { DO: [
        { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 2 } },
        { type: 'timing_wait', inputs: { DURATION: 1 } },
      ] } },
    ]);
    expect(viaParsed).toEqual(viaBlocks);
  });
});
