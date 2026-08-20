// src/categories/sensors.ts
//
// SENSORS & DATA (#8B5CF6) — a.md Sensors category.
// Reporter/boolean blocks resolve at runtime via GET_SENSOR_DATA → TELEMETRY
// (the sequencer's `getSensorValue(json)` sandbox); pin I/O + reset blocks are
// plain statements that stream a command.

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';

const PORTS: [string, string][] = [
  ['G1', 'G1'], ['G2', 'G2'], ['G3', 'G3'], ['G4', 'G4'],
  ['G5', 'G5'], ['G6', 'G6'], ['G7', 'G7'], ['G8', 'G8'],
];
const UNITS: [string, string][] = [['cm', 'cm'], ['inch', 'inch']];

defineOnce([
  // --- Boolean sensors ---
  { "type": "sensor_button1", "message0": "Touch Button 1 is pressed", "output": "Boolean", "style": "sensors_blocks" },
  { "type": "sensor_button2", "message0": "Touch Button 2 is pressed", "output": "Boolean", "style": "sensors_blocks" },
  { "type": "sensor_is_recording", "message0": "Is Recording?", "output": "Boolean", "style": "sensors_blocks" },

  // --- Pin I/O (statements + reporters) ---
  {
    "type": "sensor_set_analog",
    "message0": "Set Analog Pin on Port %1 to %2",
    "args0": [
      { "type": "field_dropdown", "name": "PORT", "options": PORTS },
      { "type": "field_slider", "name": "VALUE", "value": 0, "min": 0, "max": 255 }
    ],
    "previousStatement": null, "nextStatement": null, "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_get_analog",
    "message0": "Get Analog Pin on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks",
  },
  {
    "type": "sensor_set_digital",
    "message0": "Set Digital Pin on Port %1 to %2",
    "args0": [
      { "type": "field_dropdown", "name": "PORT", "options": PORTS },
      { "type": "field_dropdown", "name": "VALUE", "options": [["HIGH", "HIGH"], ["LOW", "LOW"]] }
    ],
    "previousStatement": null, "nextStatement": null, "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_get_digital",
    "message0": "Get Digital Pin on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks",
  },

  // --- Distance / environment reporters ---
  {
    "type": "sensor_ultrasonic",
    "message0": "Ultrasonic Sensor Value in %1 on Port %2",
    "args0": [
      { "type": "field_dropdown", "name": "UNIT", "options": UNITS },
      { "type": "field_dropdown", "name": "PORT", "options": PORTS }
    ],
    "output": "Number", "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_temperature",
    "message0": "Temperature Sensor Value (°C) on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_humidity",
    "message0": "Humidity Sensor Value (%%) on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_light",
    "message0": "Light Sensor Value (lux) on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_distance",
    "message0": "Distance Travelled (cm) on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_reset_distance",
    "message0": "Reset Distance Travelled on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "previousStatement": null, "nextStatement": null, "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_heading",
    "message0": "Heading Value (deg) on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "output": "Number", "style": "sensors_blocks", "inputsInline": true,
  },
  {
    "type": "sensor_reset_heading",
    "message0": "Reset Heading Value on Port %1",
    "args0": [{ "type": "field_dropdown", "name": "PORT", "options": PORTS }],
    "previousStatement": null, "nextStatement": null, "style": "sensors_blocks", "inputsInline": true,
  }
]);

// --- Reporter helper: emit a getSensorValue("<GET_SENSOR_DATA json>") call ---
function reporter(sensor: string, extra: Record<string, unknown> = {}) {
  return function (block: Blockly.Block): [string, number] {
    const params: Record<string, unknown> = { sensor, ...extra };
    if (block.getField('PORT')) params.port = block.getFieldValue('PORT');
    if (block.getField('UNIT')) params.unit = block.getFieldValue('UNIT');
    const json = JSON.stringify({ command: astroidV2.commands.getSensorData, params });
    return [`getSensorValue(${JSON.stringify(json)})`, Order.FUNCTION_CALL];
  };
}

// Booleans compare the reporter against a truthy value so conditions type-check.
function boolReporter(sensor: string) {
  return function (): [string, number] {
    const json = JSON.stringify({ command: astroidV2.commands.getSensorData, params: { sensor } });
    return [`(getSensorValue(${JSON.stringify(json)}) === 1)`, Order.EQUALITY];
  };
}

javascriptGenerator.forBlock['sensor_button1'] = boolReporter('button1');
javascriptGenerator.forBlock['sensor_button2'] = boolReporter('button2');
javascriptGenerator.forBlock['sensor_is_recording'] = boolReporter('recording');

javascriptGenerator.forBlock['sensor_get_analog'] = reporter('analog');
javascriptGenerator.forBlock['sensor_get_digital'] = reporter('digital');
javascriptGenerator.forBlock['sensor_ultrasonic'] = reporter('ultrasonic');
javascriptGenerator.forBlock['sensor_temperature'] = reporter('temperature');
javascriptGenerator.forBlock['sensor_humidity'] = reporter('humidity');
javascriptGenerator.forBlock['sensor_light'] = reporter('light');
javascriptGenerator.forBlock['sensor_distance'] = reporter('distance');
javascriptGenerator.forBlock['sensor_heading'] = reporter('heading');

javascriptGenerator.forBlock['sensor_set_analog'] = function (block) {
  return JSON.stringify({ command: astroidV2.commands.setAnalog, params: { port: block.getFieldValue('PORT'), value: parseInt(block.getFieldValue('VALUE'), 10) } }) + ';';
};
javascriptGenerator.forBlock['sensor_set_digital'] = function (block) {
  return JSON.stringify({ command: astroidV2.commands.setDigital, params: { port: block.getFieldValue('PORT'), value: block.getFieldValue('VALUE') } }) + ';';
};
javascriptGenerator.forBlock['sensor_reset_distance'] = function (block) {
  return JSON.stringify({ command: astroidV2.commands.resetDistance, params: { port: block.getFieldValue('PORT') } }) + ';';
};
javascriptGenerator.forBlock['sensor_reset_heading'] = function (block) {
  return JSON.stringify({ command: astroidV2.commands.resetHeading, params: { port: block.getFieldValue('PORT') } }) + ';';
};

export const sensorsCategory = {
  kind: 'category',
  name: 'Sensors & Data',
  categorystyle: 'sensors_category',
  cssconfig: { icon: 'icon-sensors' },
  contents: [
    { kind: 'label', text: 'Sensors & Data' },
    { kind: 'block', type: 'sensor_button1' },
    { kind: 'block', type: 'sensor_button2' },
    { kind: 'block', type: 'sensor_is_recording' },
    { kind: 'block', type: 'sensor_set_analog' },
    { kind: 'block', type: 'sensor_get_analog' },
    { kind: 'block', type: 'sensor_set_digital' },
    { kind: 'block', type: 'sensor_get_digital' },
    { kind: 'block', type: 'sensor_ultrasonic' },
    { kind: 'block', type: 'sensor_temperature' },
    { kind: 'block', type: 'sensor_humidity' },
    { kind: 'block', type: 'sensor_light' },
    { kind: 'block', type: 'sensor_distance' },
    { kind: 'block', type: 'sensor_reset_distance' },
    { kind: 'block', type: 'sensor_heading' },
    { kind: 'block', type: 'sensor_reset_heading' },
  ],
};
