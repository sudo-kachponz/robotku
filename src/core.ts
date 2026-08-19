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

const styleMap: { [key: string]: string } = {
  // Control
  controls_if: 'control_blocks',
  controls_ifelse: 'control_blocks',
  controls_repeat_ext: 'control_blocks',
  controls_whileUntil: 'control_blocks',
  controls_for: 'control_blocks',
  controls_forEach: 'control_blocks',
  controls_flow_statements: 'control_blocks',
  
  // Logic & Math
  logic_compare: 'operators_blocks',
  logic_operation: 'operators_blocks',
  logic_negate: 'operators_blocks',
  logic_boolean: 'operators_blocks',
  logic_null: 'operators_blocks',
  logic_ternary: 'operators_blocks',
  math_number: 'operators_blocks',
  math_arithmetic: 'operators_blocks',
  math_single: 'operators_blocks',
  math_trig: 'operators_blocks',
  math_constant: 'operators_blocks',
  math_number_property: 'operators_blocks',
  math_round: 'operators_blocks',
  math_on_list: 'operators_blocks',
  math_modulo: 'operators_blocks',
  math_constrain: 'operators_blocks',
  math_random_int: 'operators_blocks',
  math_random_float: 'operators_blocks',
  
  // Text
  text: 'text_blocks',
  text_join: 'text_blocks',
  text_append: 'variables_blocks',
  text_length: 'operators_blocks',
  text_charAt: 'operators_blocks',
  lists_create_with: 'operators_blocks',
  lists_length: 'operators_blocks',
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