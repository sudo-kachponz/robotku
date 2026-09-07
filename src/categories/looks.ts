// src/categories/looks.ts
//
// DISPLAY (#3B82F6) — a.md Display category: LED Matrix + LCD Screen.
// The 5x5 matrix uses a 25-char on/off pattern string (row-major, '1'=on).

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';
import { numArg, type NumOrExpr } from './_args';

const DEFAULT_MATRIX = '0110010010111110100010001'; // a friendly heart-ish glyph

defineOnce([
  // --- LED Matrix ---
  {
    type: 'display_matrix',
    message0: 'Display LED %1 for %2 sec',
    args0: [
      { type: 'field_input', name: 'PATTERN', text: DEFAULT_MATRIX },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
    tooltip: 'Show a 5x5 LED pattern (25 bits, row-major) for N seconds.',
  },
  {
    type: 'display_text',
    message0: 'Display Text %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'Hi!' }],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
  },
  // Kaomoji templates — ASCII faces the OLED font (CP437) renders as-is via
  // DISPLAY_TEXT. Kid-friendly "pixel-art" faces without typing.
  {
    type: 'display_kaomoji',
    message0: 'Display face %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'FACE',
        options: [
          ['(^_^) happy', '(^_^)'],
          ['\\(^o^)/ yay', '\\(^o^)/'],
          ['(T_T) cry', '(T_T)'],
          ['(>_<) ouch', '(>_<)'],
          ['(o_O) huh', '(o_O)'],
          ['(^_-) wink', '(^_-)'],
          ['(=^.^=) cat', '(=^.^=)'],
          ['(*_*) wow', '(*_*)'],
          ['(-_-) meh', '(-_-)'],
          ['(u_u)zzz sleepy', '(u_u)zzz'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
    tooltip: 'Show a kaomoji face on the OLED (sent as text).',
  },
  {
    type: 'display_set_brightness',
    message0: 'Set LED Brightness %1',
    args0: [{ type: 'field_slider', name: 'VALUE', value: 100, min: 0, max: 100 }],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
  },
  {
    type: 'display_clear_matrix',
    message0: 'Clear LED Matrix',
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
  },
  // --- RGB LED (Robotku FW-06): 8-color pick + duration ---
  // Digital LED = 8 colors (any mix of R/G/B), so a dropdown matches the hardware
  // exactly and needs no field_colour plugin (which requires Blockly 13; we're on 12).
  {
    type: 'set_led_color',
    message0: 'Set LED %1 for %2 sec',
    args0: [
      {
        type: 'field_dropdown',
        name: 'COLOR',
        options: [
          ['Red', '255,0,0'],
          ['Green', '0,255,0'],
          ['Blue', '0,0,255'],
          ['Yellow', '255,255,0'],
          ['Cyan', '0,255,255'],
          ['Pink', '255,0,255'],
          ['White', '255,255,255'],
          ['Off', '0,0,0'],
        ],
      },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
    tooltip: 'Light the RGB LED a color, held for N seconds.',
  },
  // --- LCD Screen ---
  {
    type: 'lcd_shape',
    message0: 'Display Shape %1 for %2 sec',
    args0: [
      {
        type: 'field_dropdown',
        name: 'SHAPE',
        options: [
          ['Left Arrow', 'left_arrow'],
          ['Right Arrow', 'right_arrow'],
          ['Heart', 'heart'],
          ['Smile', 'smile'],
          ['Sad', 'sad'],
          ['Star', 'star'],
        ],
      },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
  },
  {
    type: 'lcd_text',
    message0: 'Display Text %1 for %2 sec',
    args0: [
      { type: 'field_input', name: 'TEXT', text: 'Robotku' },
      { type: 'input_value', name: 'DURATION', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
    inputsInline: true,
  },
  {
    type: 'lcd_clear',
    message0: 'Clear Screen',
    previousStatement: null,
    nextStatement: null,
    style: 'looks_blocks',
  },
]);

const secs = (block: Blockly.Block, gen: typeof javascriptGenerator): NumOrExpr =>
  numArg(block, gen, 'DURATION', 1);

javascriptGenerator.forBlock['display_matrix'] = function (block, gen) {
  const raw = String(block.getFieldValue('PATTERN') || '');
  const pattern = raw
    .split('')
    .slice(0, 25)
    .map((c) => (c === '1' ? 1 : 0));
  while (pattern.length < 25) pattern.push(0);
  return (
    JSON.stringify({
      command: astroidV2.commands.displayMatrix,
      params: { pattern, secs: secs(block, gen) },
    }) + ';'
  );
};

javascriptGenerator.forBlock['display_text'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.displayText,
      params: { text: block.getFieldValue('TEXT') },
    }) + ';'
  );
};

javascriptGenerator.forBlock['display_kaomoji'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.displayText,
      params: { text: block.getFieldValue('FACE') },
    }) + ';'
  );
};

javascriptGenerator.forBlock['display_set_brightness'] = function (block) {
  return (
    JSON.stringify({
      command: astroidV2.commands.setLedBrightness,
      params: { value: parseInt(block.getFieldValue('VALUE'), 10) },
    }) + ';'
  );
};

javascriptGenerator.forBlock['display_clear_matrix'] = function () {
  return JSON.stringify({ command: astroidV2.commands.clearMatrix, params: {} }) + ';';
};

javascriptGenerator.forBlock['set_led_color'] = function (block, gen) {
  const [r, g, b] = String(block.getFieldValue('COLOR'))
    .split(',')
    .map((n) => parseInt(n, 10) || 0);
  return (
    JSON.stringify({
      command: astroidV2.commands.setLedColor,
      params: { r, g, b, secs: secs(block, gen) },
    }) + ';'
  );
};

javascriptGenerator.forBlock['lcd_shape'] = function (block, gen) {
  return (
    JSON.stringify({
      command: astroidV2.commands.lcdShape,
      params: { shape: block.getFieldValue('SHAPE'), secs: secs(block, gen) },
    }) + ';'
  );
};

javascriptGenerator.forBlock['lcd_text'] = function (block, gen) {
  return (
    JSON.stringify({
      command: astroidV2.commands.lcdText,
      params: { text: block.getFieldValue('TEXT'), secs: secs(block, gen) },
    }) + ';'
  );
};

javascriptGenerator.forBlock['lcd_clear'] = function () {
  return JSON.stringify({ command: astroidV2.commands.lcdClear, params: {} }) + ';';
};

const durShadow = { DURATION: { shadow: { type: 'math_number', fields: { NUM: 1 } } } };

export const looksCategory = {
  kind: 'category',
  name: 'Display',
  categorystyle: 'looks_category',
  cssconfig: { icon: 'icon-looks' },
  contents: [
    { kind: 'label', text: 'Display' },
    { kind: 'label', text: 'LED Matrix' },
    { kind: 'block', type: 'display_matrix', inputs: durShadow },
    { kind: 'block', type: 'display_text' },
    { kind: 'block', type: 'display_kaomoji' },
    { kind: 'block', type: 'display_set_brightness' },
    { kind: 'block', type: 'display_clear_matrix' },
    { kind: 'label', text: 'RGB LED' },
    { kind: 'block', type: 'set_led_color', inputs: durShadow },
    { kind: 'label', text: 'LCD Screen' },
    { kind: 'block', type: 'lcd_shape', inputs: durShadow },
    { kind: 'block', type: 'lcd_text', inputs: durShadow },
    { kind: 'block', type: 'lcd_clear' },
  ],
};
