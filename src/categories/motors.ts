// src/categories/motors.ts
//
// MOVEMENT (#16A34A) — a.md Movement category.
// Forward/Reverse/Left/Right (timed), Steering, Claw, and the red Stop blocks.
// Forward/Reverse/Left/Right keep emitting the legacy MOVE_TIMED / TURN_TIMED
// shape so the 3D simulator keeps animating; the new blocks emit Robotku v1.1
// opcodes (safely skipped by the simulator when it has no visual for them).

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { astroidV2, SPEED_ENUM } from '../robotProfiles';

const SPEED_OPTIONS: [string, string][] = [['Slow', 'slow'], ['Medium', 'medium'], ['Fast', 'fast']];
const MOTOR_PORTS: [string, string][] = [['M1', 'M1'], ['M2', 'M2'], ['M3', 'M3'], ['M4', 'M4']];

// --- Block Definitions ---
defineOnce([
  {
    "type": "move_forward",
    "message0": "Forward for %1 sec  Speed %2  Ports L %3 R %4",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" },
      { "type": "field_dropdown", "name": "SPEED", "options": SPEED_OPTIONS },
      { "type": "field_dropdown", "name": "LEFT", "options": MOTOR_PORTS },
      { "type": "field_dropdown", "name": "RIGHT", "options": [["M2", "M2"], ["M1", "M1"], ["M3", "M3"], ["M4", "M4"]] }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "move_reverse",
    "message0": "Reverse for %1 sec  Speed %2  Ports L %3 R %4",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" },
      { "type": "field_dropdown", "name": "SPEED", "options": SPEED_OPTIONS },
      { "type": "field_dropdown", "name": "LEFT", "options": MOTOR_PORTS },
      { "type": "field_dropdown", "name": "RIGHT", "options": [["M2", "M2"], ["M1", "M1"], ["M3", "M3"], ["M4", "M4"]] }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "move_left",
    "message0": "Left for %1 sec  Speed %2  Ports L %3 R %4",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" },
      { "type": "field_dropdown", "name": "SPEED", "options": SPEED_OPTIONS },
      { "type": "field_dropdown", "name": "LEFT", "options": MOTOR_PORTS },
      { "type": "field_dropdown", "name": "RIGHT", "options": [["M2", "M2"], ["M1", "M1"], ["M3", "M3"], ["M4", "M4"]] }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "move_right",
    "message0": "Right for %1 sec  Speed %2  Ports L %3 R %4",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" },
      { "type": "field_dropdown", "name": "SPEED", "options": SPEED_OPTIONS },
      { "type": "field_dropdown", "name": "LEFT", "options": MOTOR_PORTS },
      { "type": "field_dropdown", "name": "RIGHT", "options": [["M2", "M2"], ["M1", "M1"], ["M3", "M3"], ["M4", "M4"]] }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "move_steer",
    "message0": "Steering for %1 sec  Steering %2  Speed %3  Ports L %4 R %5",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" },
      { "type": "field_slider", "name": "STEERING", "value": 0, "min": -100, "max": 100 },
      { "type": "field_dropdown", "name": "SPEED", "options": SPEED_OPTIONS },
      { "type": "field_dropdown", "name": "LEFT", "options": MOTOR_PORTS },
      { "type": "field_dropdown", "name": "RIGHT", "options": [["M2", "M2"], ["M1", "M1"], ["M3", "M3"], ["M4", "M4"]] }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "move_claw",
    "message0": "Claw for %1 sec  Direction %2  Speed %3  Port %4",
    "args0": [
      { "type": "input_value", "name": "DURATION", "check": "Number" },
      { "type": "field_dropdown", "name": "DIRECTION", "options": [["Clockwise", "clockwise"], ["Anticlockwise", "anticlockwise"]] },
      { "type": "field_dropdown", "name": "SPEED", "options": SPEED_OPTIONS },
      { "type": "field_dropdown", "name": "PORT", "options": MOTOR_PORTS }
    ],
    "previousStatement": null, "nextStatement": null, "style": "motors_blocks", "inputsInline": true,
  },
  {
    "type": "move_stop",
    "message0": "Stop %1  Ports L %2 R %3",
    "args0": [
      { "type": "field_dropdown", "name": "WHEELS", "options": [["2 WHEEL", "2"], ["4 WHEEL", "4"]] },
      { "type": "field_dropdown", "name": "LEFT", "options": MOTOR_PORTS },
      { "type": "field_dropdown", "name": "RIGHT", "options": [["M2", "M2"], ["M1", "M1"], ["M3", "M3"], ["M4", "M4"]] }
    ],
    "previousStatement": null, "nextStatement": null, "colour": "#DC2626", "inputsInline": true,
  },
  {
    "type": "move_stop_all",
    "message0": "Stop All Motors",
    "previousStatement": null, "nextStatement": null, "colour": "#DC2626",
    "tooltip": "Halts every motor immediately."
  }
]);

// --- Helpers ---
function durSecs(block: Blockly.Block, gen: typeof javascriptGenerator): number {
  const raw = parseFloat(gen.valueToCode(block, 'DURATION', Order.ATOMIC) || '1');
  return Math.max(0.1, raw);
}

// --- Block Generators ---
// Forward/Reverse/Left/Right map to the legacy simulator opcodes so the robot
// still animates offline, while carrying the extra Robotku fields as params.
function driveTimed(command: string, direction: string) {
  return function (block: Blockly.Block, gen: typeof javascriptGenerator) {
    const secs = durSecs(block, gen);
    const speed = SPEED_ENUM[block.getFieldValue('SPEED')] ?? 70;
    const commandObj = {
      command,
      params: {
        direction,
        speed,
        duration_ms: secs * 1000,
        left: block.getFieldValue('LEFT'),
        right: block.getFieldValue('RIGHT'),
      },
    };
    return JSON.stringify(commandObj) + ';';
  };
}

javascriptGenerator.forBlock['move_forward'] = driveTimed(astroidV2.commands.moveTimed, 'forward');
javascriptGenerator.forBlock['move_reverse'] = driveTimed(astroidV2.commands.moveTimed, 'backward');
javascriptGenerator.forBlock['move_left'] = driveTimed(astroidV2.commands.turnTimed, 'left');
javascriptGenerator.forBlock['move_right'] = driveTimed(astroidV2.commands.turnTimed, 'right');

javascriptGenerator.forBlock['move_steer'] = function (block, gen) {
  const commandObj = {
    command: astroidV2.commands.steerTimed,
    params: {
      duration_ms: durSecs(block, gen) * 1000,
      steering: parseInt(block.getFieldValue('STEERING'), 10),
      speed: SPEED_ENUM[block.getFieldValue('SPEED')] ?? 70,
      left: block.getFieldValue('LEFT'),
      right: block.getFieldValue('RIGHT'),
    },
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['move_claw'] = function (block, gen) {
  const commandObj = {
    command: astroidV2.commands.clawTimed,
    params: {
      duration_ms: durSecs(block, gen) * 1000,
      direction: block.getFieldValue('DIRECTION'),
      speed: SPEED_ENUM[block.getFieldValue('SPEED')] ?? 70,
      port: block.getFieldValue('PORT'),
    },
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['move_stop'] = function (block) {
  const commandObj = {
    command: astroidV2.commands.stop,
    params: {
      wheels: parseInt(block.getFieldValue('WHEELS'), 10),
      left: block.getFieldValue('LEFT'),
      right: block.getFieldValue('RIGHT'),
    },
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['move_stop_all'] = function () {
  return JSON.stringify({ command: astroidV2.commands.stopAll, params: {} }) + ';';
};

// --- Toolbox Definition ---
const durationShadow = { DURATION: { shadow: { type: 'math_number', fields: { NUM: 1 } } } };

export const motorsCategory = {
  kind: 'category',
  name: 'Movement',
  categorystyle: 'motors_category',
  cssconfig: { icon: 'icon-motion' },
  contents: [
    { kind: 'label', text: 'Movement' },
    { kind: 'block', type: 'move_forward', inputs: durationShadow },
    { kind: 'block', type: 'move_reverse', inputs: durationShadow },
    { kind: 'block', type: 'move_left', inputs: durationShadow },
    { kind: 'block', type: 'move_right', inputs: durationShadow },
    { kind: 'block', type: 'move_steer', inputs: durationShadow },
    { kind: 'block', type: 'move_claw', inputs: durationShadow },
    { kind: 'block', type: 'move_stop' },
    { kind: 'block', type: 'move_stop_all' },
  ],
};
