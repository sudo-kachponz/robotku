// src/core.ts

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
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
import './categories/variables';
import './categories/functions_gen';

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

  stampBlockIdsIntoCommands();

  isInitialized = true;
  console.log("Astroid Blockly Core Initialized.");
}

/**
 * Wrap every statement generator ONCE so each emitted `{"command":...,"params":{...}}`
 * segment carries `params._bid` = the source block id. The runtime uses it to glow
 * the running block (onStep). Firmware ignores unknown params keys, so the wire
 * contract is unchanged. Reporter generators (which return a [code, order] tuple)
 * are skipped — they produce expressions, not command segments. Because nested
 * child code is generated first, each segment is stamped by its OWN block: we only
 * add `_bid` to segments that don't already have one.
 */
function stampBlockIdsIntoCommands(): void {
  const forBlock = javascriptGenerator.forBlock;
  for (const type of Object.keys(forBlock)) {
    const original = forBlock[type];
    if (typeof original !== 'function') continue;
    forBlock[type] = function (this: unknown, block: Blockly.Block, generator: typeof javascriptGenerator) {
      const code = (original as any).call(this, block, generator);
      if (typeof code !== 'string' || code.indexOf('"command"') === -1) return code;
      return code
        .split(';')
        .map((segment) => {
          const trimmed = segment.trim();
          if (!trimmed) return segment;
          try {
            const obj = JSON.parse(trimmed);
            if (obj && typeof obj === 'object' && obj.command) {
              obj.params = obj.params || {};
              if (obj.params._bid == null) obj.params._bid = block.id;
              return JSON.stringify(obj);
            }
          } catch {
            /* not a JSON command segment — leave as-is */
          }
          return segment;
        })
        .join(';');
    } as typeof original;
  }
}