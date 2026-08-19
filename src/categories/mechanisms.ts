// src/categories/mechanisms.ts

import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';

Blockly.defineBlocksWithJsonArray([
  {
    "type": "mechanism_set_head",
    "message0": "Set head position to Pitch: %1 Yaw: %2",
    "args0": [
      {
        "type": "field_slider", "name": "PITCH", "value": 90, "min": 80, "max": 100
      },
      {
        "type": "field_slider", "name": "YAW", "value": 90, "min": 80, "max": 100
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "motion_blocks",
    "tooltip": "Sets the head servos' angles (80-100 degrees, hardware constrained).",
    "inputsInline": true,
  },
  {
    "type": "mechanism_set_gripper",
    "message0": "%1 Gripper",
    "args0": [
      { "type": "field_dropdown", "name": "STATE", "options": [ ["Open", "open"], ["Close", "closed"] ] }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "functions_blocks",
    "tooltip": "Opens or closes the robot's gripper."
  }
]);

javascriptGenerator.forBlock['mechanism_set_head'] = function(block, _generator) {
  const pitch = block.getFieldValue('PITCH');
  const yaw = block.getFieldValue('YAW');

  const commandObj = {
    command: astroidV2.commands.setHeadPosition,
    params: { pitch: parseInt(pitch, 10), yaw: parseInt(yaw, 10) }
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['mechanism_set_gripper'] = function(block, _generator) {
  const state = block.getFieldValue('STATE');
  const commandObj = {
    command: astroidV2.commands.setGripper,
    params: { state: state }
  };
  return JSON.stringify(commandObj) + ';';
};


export const mechanismsCategory = {
  kind: 'category',
  name: 'Parts',
  categorystyle: 'motion_category',
  contents: [
    { kind: 'block', type: 'mechanism_set_head' },
    { kind: 'block', type: 'mechanism_set_gripper' },
  ],
};