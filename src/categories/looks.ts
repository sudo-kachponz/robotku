// src/categories/looks.ts

import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';

Blockly.defineBlocksWithJsonArray([
  {
    "type": "looks_set_all_leds",
    "message0": "Set all LEDs to color %1",
    "args0": [
      {
        "type": "field_colour_hsv_sliders",
        "name": "COLOR",
        "colour": "#ff0000"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "looks_blocks",
    "tooltip": "Sets all 12 LEDs to the same color."
  },
  {
    "type": "looks_set_single_led",
    "message0": "Set LED number %1 to color %2",
    "args0": [
      { 
        "type": "field_slider", 
        "name": "LED_ID", 
        "value": 1, "min": 1, "max": 12 
      },
      {
        "type": "field_colour_hsv_sliders",
        "name": "COLOR",
        "colour": "#0000ff"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "looks_blocks",
    "tooltip": "Sets a single LED (1-12) to a color.",
    "inputsInline": true
  },
  {
    "type": "looks_display_icon",
    "message0": "Display icon %1 on screen",
    "args0": [
      { "type": "field_dropdown", "name": "ICON", "options": [ ["Happy", "happy"], ["Sad", "sad"], ["Confused", "confused"], ["Mad", "mad"] ] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "looks_blocks",
    "tooltip": "Shows a pre-loaded icon on the LCD."
  }
]);

// Helper for color parsing
function hexToRgb(hex: string) {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return { r, g, b };
}

javascriptGenerator.forBlock['looks_set_all_leds'] = function(block, _generator) {
  const color = block.getFieldValue('COLOR') || '#ffffff';
  const { r, g, b } = hexToRgb(color);

  const commandObj = {
    command: astroidV2.commands.setLedColor,
    params: { led_id: "all", r, g, b }
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['looks_set_single_led'] = function(block, _generator) {
  const ledId = parseInt(block.getFieldValue('LED_ID') || '1', 10);

  const color = block.getFieldValue('COLOR') || '#ffffff';
  const { r, g, b } = hexToRgb(color);
  
  const commandObj = {
    command: astroidV2.commands.setLedColor,
    params: { led_id: ledId, r, g, b }
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['looks_display_icon'] = function(block, _generator) {
  const icon = block.getFieldValue('ICON');
  const commandObj = {
    command: astroidV2.commands.displayIcon,
    params: { icon_name: icon }
  };
  return JSON.stringify(commandObj) + ';';
};


// --- Toolbox ---
export const looksCategory = {
  kind: 'category',
  name: 'Looks',
  categorystyle: 'looks_category',
  contents: [
    { 
      kind: 'block', 
      type: 'looks_set_all_leds' 
    },
    { 
      kind: 'block', 
      type: 'looks_set_single_led',
    },
    { 
      kind: 'block', 
      type: 'looks_display_icon' 
    },
  ],
};