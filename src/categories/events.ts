// src/categories/events.ts
//
// TIMING (#E08600) — a.md Timing category, plus the "Start Program" hat block.
// - program_start: the non-deletable hat that wraps the program (kept as the
//   "Start Program … End" wrapper; loaded into the initial workspace).
// - timing_wait: Wait for N sec  → {"command":"WAIT",...}
// - timing_wait_until: Wait for <boolean> → sequencer polls until true.

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { numArg, mulNum } from './_args';

defineOnce([
  {
    "type": "program_start",
    "message0": "Start Program",
    "nextStatement": null,
    "style": "hat_blocks",
    "tooltip": "The starting point of your program."
  },
  {
    "type": "timing_wait",
    "message0": "Wait for %1 sec",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "events_blocks",
    "inputsInline": true,
    "tooltip": "Pause the program for a number of seconds."
  },
  {
    "type": "timing_wait_until",
    "message0": "Wait until %1",
    "args0": [
      { "type": "input_value", "name": "CONDITION", "check": "Boolean" }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "events_blocks",
    "inputsInline": true,
    "tooltip": "Pause the program until the condition becomes true."
  }
]);

javascriptGenerator.forBlock['timing_wait'] = function (block, gen) {
  return JSON.stringify({ command: 'WAIT', params: { duration_ms: mulNum(numArg(block, gen, 'DURATION', 1), 1000) } }) + ';';
};

javascriptGenerator.forBlock['timing_wait_until'] = function (block, gen) {
  const condition = gen.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  return JSON.stringify({ command: 'WAIT_UNTIL', params: { condition } }) + ';';
};

export const timingCategory = {
  kind: 'category',
  name: 'Timing',
  categorystyle: 'events_category',
  cssconfig: { icon: 'icon-timing' },
  contents: [
    { kind: 'label', text: 'Timing' },
    { kind: 'block', type: 'timing_wait', inputs: { DURATION: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
    { kind: 'block', type: 'timing_wait_until' },
  ],
};

// Back-compat alias (older imports referenced `eventsCategory`).
export const eventsCategory = timingCategory;
