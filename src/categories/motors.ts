// src/categories/motors.ts
//
// MOVEMENT (#16A34A) — a.md Movement category.
// Forward/Reverse/Left/Right (timed), Steering, Claw, and the red Stop blocks.
// Forward/Reverse/Left/Right keep emitting the legacy MOVE_TIMED / TURN_TIMED
// shape so the 3D simulator keeps animating; the new blocks emit Robotku v1.1
// opcodes (safely skipped by the simulator when it has no visual for them).

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator } from 'blockly/javascript';
import { astroidV2, SPEED_ENUM } from '../robotProfiles';
import { numArg, mulNum } from './_args';

const SPEED_OPTIONS: [string, string][] = [
  ['Slow', 'slow'],
  ['Medium', 'medium'],
  ['Fast', 'fast'],
];
// Drive ports are the PWM/servo ports P1..P5 (this board has no motor ports).
// LEFT defaults to P1, RIGHT to P2 — the two drive servos verified on hardware.
const MOTOR_PORTS: [string, string][] = [
  ['P1', 'P1'],
  ['P2', 'P2'],
  ['P3', 'P3'],
  ['P4', 'P4'],
  ['P5', 'P5'],
];

// --- Block Definitions ---
defineOnce([
  {
    type: 'move_forward',
    message0: 'Forward for %1 sec  Speed %2',
    args0: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'SPEED', options: SPEED_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
  },
  {
    type: 'move_reverse',
    message0: 'Reverse for %1 sec  Speed %2',
    args0: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'SPEED', options: SPEED_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
  },
  {
    type: 'move_left',
    message0: 'Left for %1 sec  Speed %2',
    args0: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'SPEED', options: SPEED_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
  },
  {
    type: 'move_right',
    message0: 'Right for %1 sec  Speed %2',
    args0: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'SPEED', options: SPEED_OPTIONS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
  },
  {
    type: 'move_steer',
    message0: 'Steering for %1 sec  Speed %2',
    args0: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'SPEED', options: SPEED_OPTIONS },
    ],
    message1: 'Steering %1',
    args1: [{ type: 'field_slider', name: 'STEERING', value: 0, min: -100, max: 100 }],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
  },
  {
    type: 'move_claw',
    message0: 'Claw for %1 sec  Speed %2',
    args0: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
      { type: 'field_dropdown', name: 'SPEED', options: SPEED_OPTIONS },
    ],
    message1: 'Direction %1  Port %2',
    args1: [
      {
        type: 'field_dropdown',
        name: 'DIRECTION',
        options: [
          ['Clockwise', 'clockwise'],
          ['Anticlockwise', 'anticlockwise'],
        ],
      },
      { type: 'field_dropdown', name: 'PORT', options: MOTOR_PORTS },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
  },
  {
    type: 'move_stop',
    message0: 'Stop %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'WHEELS',
        options: [
          ['2 WHEEL', '2'],
          ['4 WHEEL', '4'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: '#DC2626',
    inputsInline: true,
  },
  {
    type: 'move_stop_all',
    message0: 'Stop All Motors',
    previousStatement: null,
    nextStatement: null,
    colour: '#DC2626',
    tooltip: 'Halts every motor immediately.',
  },
  {
    // Test ONE servo at a time (the drive blocks always move L+R together).
    type: 'servo_single',
    message0: 'Uji servo %1  kecepatan %2',
    args0: [
      { type: 'field_dropdown', name: 'PORT', options: MOTOR_PORTS },
      { type: 'field_slider', name: 'SPEED', value: 100, min: -100, max: 100 },
    ],
    message1: 'selama %1 dtk',
    args1: [
      { type: 'input_value', name: 'DURATION', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    style: 'motors_blocks',
    inputsInline: true,
    tooltip: 'Putar SATU servo (uji tiap servo sendiri-sendiri). Berhenti otomatis setelah durasinya.',
  },
]);

// --- Block Generators ---
// Forward/Reverse/Left/Right map to the legacy simulator opcodes so the robot
// still animates offline, while carrying the extra Robotku fields as params.
// DURATION is run-time-resolvable (numArg) so variables / Math / sensor reporters
// work inside it; constant inputs stay byte-identical.
function driveTimed(command: string, direction: string) {
  return function (block: Blockly.Block, gen: typeof javascriptGenerator) {
    const speed = SPEED_ENUM[block.getFieldValue('SPEED')] ?? 70;
    const commandObj = {
      command,
      params: {
        direction,
        speed,
        duration_ms: mulNum(numArg(block, gen, 'DURATION', 1), 1000),
        // Left=P1, Right=P2 are fixed on this board (the firmware drives those pins);
        // the port pickers were removed from the block to keep it short on mobile.
        left: 'P1',
        right: 'P2',
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
      duration_ms: mulNum(numArg(block, gen, 'DURATION', 1), 1000),
      steering: parseInt(block.getFieldValue('STEERING'), 10),
      speed: SPEED_ENUM[block.getFieldValue('SPEED')] ?? 70,
      left: 'P1',
      right: 'P2',
    },
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['move_claw'] = function (block, gen) {
  const commandObj = {
    command: astroidV2.commands.clawTimed,
    params: {
      duration_ms: mulNum(numArg(block, gen, 'DURATION', 1), 1000),
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
      left: 'P1',
      right: 'P2',
    },
  };
  return JSON.stringify(commandObj) + ';';
};

javascriptGenerator.forBlock['move_stop_all'] = function () {
  return JSON.stringify({ command: astroidV2.commands.stopAll, params: {} }) + ';';
};

javascriptGenerator.forBlock['servo_single'] = function (block, gen) {
  const port = parseInt(block.getFieldValue('PORT').slice(1), 10); // 'P1' -> 1
  const speed = parseInt(block.getFieldValue('SPEED'), 10);
  const durationMs = mulNum(numArg(block, gen, 'DURATION', 1), 1000);
  // Drive one port for the duration (SET_PORT is continuous), then stop it. The
  // firmware maps P1->left, P2->right servo; unwired ports report unsupported.
  return (
    JSON.stringify({ command: 'SET_PORT', params: { port, value: speed, duration_ms: durationMs } }) +
    ';' +
    JSON.stringify({ command: 'SET_PORT', params: { port, value: 0 } }) +
    ';'
  );
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
    { kind: 'label', text: 'Uji Servo Satu-Satu' },
    { kind: 'block', type: 'servo_single', inputs: durationShadow },
    { kind: 'block', type: 'move_stop' },
    { kind: 'block', type: 'move_stop_all' },
  ],
};
