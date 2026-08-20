// src/core.ts

import * as Blockly from 'blockly';
import { FieldColourHsvSliders } from '@blockly/field-colour-hsv-sliders';
import { FieldSlider } from '@blockly/field-slider';

import './categories/motors';
import './categories/mechanisms';
import './categories/looks';
import './categories/audio';
import './categories/sensors';
import './categories/control';
import './categories/operators';
import './categories/events';

// Force the standard Blockly blocks onto the Robotku theme styles (a.md map):
// Program Flow = control_blocks (cyan), Logic = logic_blocks (teal),
// Math = math_blocks (indigo), Variables = variable_blocks (brown),
// Text stays on text_blocks.
const styleMap: { [key: string]: string } = {
  // Program Flow
  controls_if: 'control_blocks',
  controls_ifelse: 'control_blocks',
  controls_repeat_ext: 'control_blocks',
  controls_whileUntil: 'control_blocks',
  controls_for: 'control_blocks',
  controls_forEach: 'control_blocks',
  controls_flow_statements: 'control_blocks',

  // Logic
  logic_compare: 'logic_blocks',
  logic_operation: 'logic_blocks',
  logic_negate: 'logic_blocks',
  logic_boolean: 'logic_blocks',
  logic_null: 'logic_blocks',
  logic_ternary: 'logic_blocks',

  // Math
  math_number: 'math_blocks',
  math_arithmetic: 'math_blocks',
  math_single: 'math_blocks',
  math_trig: 'math_blocks',
  math_constant: 'math_blocks',
  math_number_property: 'math_blocks',
  math_round: 'math_blocks',
  math_on_list: 'math_blocks',
  math_modulo: 'math_blocks',
  math_constrain: 'math_blocks',
  math_random_int: 'math_blocks',
  math_random_float: 'math_blocks',

  // Text & lists
  text: 'text_blocks',
  text_join: 'text_blocks',
  text_append: 'variable_blocks',
  text_length: 'math_blocks',
  text_charAt: 'text_blocks',
  lists_create_with: 'math_blocks',
  lists_length: 'math_blocks',
};

let isInitialized = false;

export function initializeAstroidEditor(): void {
  if (isInitialized) return;

  Blockly.fieldRegistry.register('field_colour_hsv_sliders', FieldColourHsvSliders);
  Blockly.fieldRegistry.register('field_slider', FieldSlider);

  for (const blockType in styleMap) {
    if (Blockly.Blocks[blockType]) {
      const originalInit = Blockly.Blocks[blockType].init;
      Blockly.Blocks[blockType].init = function(this: Blockly.Block) {
        if (originalInit) {
          originalInit.call(this);
        }
        const styleName = styleMap[this.type];
        if (styleName) {
          this.setStyle(styleName);
        }
      };
    }
  }

  isInitialized = true;
  console.log("Astroid Blockly Core Initialized.");
}