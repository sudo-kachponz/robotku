// src/categories/control.ts
//
// PROGRAM FLOW (#06B6D4) — a.md Program Flow category (reskinned Blockly control).
// Repeat Forever / Repeat N times / While <bool> / Break / Continue /
// If <bool> Then/Else. Every block emits META_* opcodes the simulator
// sequencer understands (Timing's Wait now lives in categories/events.ts).

import { defineOnce } from './_defineOnce';
import { javascriptGenerator, Order } from 'blockly/javascript';

defineOnce([
  {
    "type": "controls_repeat_ext",
    "message0": "repeat %1 times",
    "args0": [
      { "type": "input_value", "name": "TIMES", "check": "Number", "shadow": { "type": "math_number", "fields": { "NUM": 10 } } }
    ],
    "message1": "do %1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null, "nextStatement": null, "style": "control_blocks",
    "tooltip": "Repeat the enclosed blocks a number of times."
  },
  {
    "type": "controls_forever",
    "message0": "repeat forever",
    "message1": "do %1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null, "nextStatement": null, "style": "control_blocks",
    "tooltip": "Repeat the enclosed blocks forever until stopped."
  },
  {
    "type": "controls_while",
    "message0": "while %1",
    "args0": [{ "type": "input_value", "name": "CONDITION", "check": "Boolean" }],
    "message1": "do %1",
    "args1": [{ "type": "input_statement", "name": "DO" }],
    "previousStatement": null, "nextStatement": null, "style": "control_blocks",
    "tooltip": "Repeat the enclosed blocks while the condition is true."
  },
  {
    "type": "controls_break",
    "message0": "break out of loop",
    "previousStatement": null, "style": "control_blocks",
    "tooltip": "Exit the current loop."
  },
  {
    "type": "controls_continue",
    "message0": "continue loop",
    "previousStatement": null, "style": "control_blocks",
    "tooltip": "Skip to the next iteration of the loop."
  }
]);

function branchCommands(branch: string): string {
  return branch.split(';').filter((c) => c.trim() !== '').join(';');
}

javascriptGenerator.forBlock['controls_repeat_ext'] = function (block, generator) {
  const repeats = generator.valueToCode(block, 'TIMES', Order.ATOMIC) || '10';
  const branch = branchCommands(generator.statementToCode(block, 'DO') || '');
  const start = JSON.stringify({ command: 'META_START_LOOP', params: { times: parseInt(repeats, 10) } });
  const end = JSON.stringify({ command: 'META_END_LOOP', params: {} });
  return `${start};${branch ? branch + ';' : ''}${end};`;
};

javascriptGenerator.forBlock['controls_forever'] = function (block, generator) {
  const branch = branchCommands(generator.statementToCode(block, 'DO') || '');
  const start = JSON.stringify({ command: 'META_START_INFINITE_LOOP', params: {} });
  const end = JSON.stringify({ command: 'META_END_LOOP', params: {} });
  return `${start};${branch ? branch + ';' : ''}${end};`;
};

// While = infinite loop that breaks when the condition turns false.
javascriptGenerator.forBlock['controls_while'] = function (block, generator) {
  const condition = generator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  const branch = branchCommands(generator.statementToCode(block, 'DO') || '');
  const start = JSON.stringify({ command: 'META_START_INFINITE_LOOP', params: {} });
  const guardIf = JSON.stringify({ command: 'META_IF', params: { condition: `!(${condition})` } });
  const brk = JSON.stringify({ command: 'META_BREAK_LOOP', params: {} });
  const endIf = JSON.stringify({ command: 'META_END_IF', params: {} });
  const end = JSON.stringify({ command: 'META_END_LOOP', params: {} });
  return `${start};${guardIf};${brk};${endIf};${branch ? branch + ';' : ''}${end};`;
};

javascriptGenerator.forBlock['controls_if'] = function (block, generator) {
  let code = '';
  let n = 0;
  do {
    const conditionCode = generator.valueToCode(block, 'IF' + n, Order.NONE) || 'false';
    const branchCode = generator.statementToCode(block, 'DO' + n) || '';
    code += JSON.stringify({ command: n === 0 ? 'META_IF' : 'META_ELSE_IF', params: { condition: conditionCode } }) + ';';
    if (branchCode) code += branchCode;
    n++;
  } while (block.getInput('IF' + n));

  if (block.getInput('ELSE')) {
    const branchCode = generator.statementToCode(block, 'ELSE') || '';
    code += JSON.stringify({ command: 'META_ELSE', params: {} }) + ';';
    if (branchCode) code += branchCode;
  }
  code += JSON.stringify({ command: 'META_END_IF', params: {} }) + ';';
  return code;
};

javascriptGenerator.forBlock['controls_break'] = function () {
  return JSON.stringify({ command: 'META_BREAK_LOOP', params: {} }) + ';';
};

javascriptGenerator.forBlock['controls_continue'] = function () {
  return JSON.stringify({ command: 'META_CONTINUE_LOOP', params: {} }) + ';';
};

export const controlCategory = {
  kind: 'category',
  name: 'Program Flow',
  categorystyle: 'control_category',
  cssconfig: { icon: 'icon-control' },
  contents: [
    { kind: 'label', text: 'Program Flow' },
    { kind: 'block', type: 'controls_forever' },
    { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
    { kind: 'block', type: 'controls_while' },
    { kind: 'block', type: 'controls_break' },
    { kind: 'block', type: 'controls_continue' },
    { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
  ],
};
