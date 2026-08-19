// src/categories/motors.ts

import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';

// --- Block Definitions ---
Blockly.defineBlocksWithJsonArray([
  {
    "type": "motor_move_timed",
    "message0": "Move %1 at %2 %% speed for %3 seconds",
    "args0": [
      { "type": "field_dropdown", "name": "DIRECTION", "options": [["Forward", "forward"], ["Backward", "backward"]] },
      {
        "type": "field_slider", "name": "SPEED", "value": 100, "min": 0, "max": 100
      },
      { "type": "input_value", "name": "DURATION", "check": "Number" }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "motor_turn_timed",
    "message0": "Turn %1 at %2 %% speed for %3 seconds",
    "args0": [
      { "type": "field_dropdown", "name": "DIRECTION", "options": [["Left", "left"], ["Right", "right"]] },
      {
        "type": "field_slider", "name": "SPEED", "value": 80, "min": 0, "max": 100
      },
      { "type": "input_value", "name": "DURATION", "check": "Number" }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "motor_drive_direct",
    "message0": "Set wheel speeds Left: %1 %% Right: %2 %%",
    "args0": [
      {
        "type": "field_slider", "name": "LEFT_SPEED", "value": 80, "min": -100, "max": 100
      },
      {
        "type": "field_slider", "name": "RIGHT_SPEED", "value": 80, "min": -100, "max": 100
      }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "motor_stop",
    "message0": "Stop Moving",
    "previousStatement": null,
    "nextStatement": null,
    "style": "motors_blocks",
    "tooltip": "Halts all robot movement."
  }
]);

// --- Block Generators ---
javascriptGenerator.forBlock['motor_move_timed'] = function(block, generator) {
  const direction = block.getFieldValue('DIRECTION');
  const speed = block.getFieldValue('SPEED');
  const userDurationSeconds = parseFloat(generator.valueToCode(block, 'DURATION', Order.ATOMIC) || '1');
  const safeDurationSeconds = Math.max(0.1, userDurationSeconds);
  
  const commandObj = {
    command: astroidV2.commands.moveTimed,
    params: {
      direction: direction,
      speed: parseInt(speed, 10),
      duration_ms: safeDurationSeconds * 1000
    }
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['motor_turn_timed'] = function(block, generator) {
  const direction = block.getFieldValue('DIRECTION');
  const speed = block.getFieldValue('SPEED');
  const userDurationSeconds = parseFloat(generator.valueToCode(block, 'DURATION', Order.ATOMIC) || '1');
  const safeDurationSeconds = Math.max(0.1, userDurationSeconds);

  const commandObj = {
    command: astroidV2.commands.turnTimed,
    params: {
      direction: direction,
      speed: parseInt(speed, 10),
      duration_ms: safeDurationSeconds * 1000
    }
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['motor_drive_direct'] = function(block, _generator) {
  const leftSpeed = block.getFieldValue('LEFT_SPEED');
  const rightSpeed = block.getFieldValue('RIGHT_SPEED');

  const commandObj = {
    command: astroidV2.commands.driveDirect,
    params: { left_speed: leftSpeed, right_speed: rightSpeed }
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['motor_stop'] = function(_block, _generator) {
  const commandObj = {
    command: astroidV2.commands.driveDirect,
    params: { left_speed: 0, right_speed: 0 }
  };
  return JSON.stringify(commandObj) + ';';
};

// --- Toolbox Definition ---
export const motorsCategory = {
  kind: 'category',
  name: 'Motion',
  categorystyle: 'motors_category',
  contents: [
    { 
      kind: 'block', 
      type: 'motor_move_timed',
      inputs: { DURATION: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } 
    },
    { 
      kind: 'block', 
      type: 'motor_turn_timed',
      inputs: { DURATION: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } 
    },
    { kind: 'block', type: 'motor_stop' },
    { 
      kind: 'block', 
      type: 'motor_drive_direct' 
    },
  ],
};