// src/categories/sensors.ts

import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { astroidV2 } from '../robotProfiles';

// --- Block Definitions ---
Blockly.defineBlocksWithJsonArray([
  {
    "type": "sensor_get_distance",
    "message0": "get distance (m)",
    "output": "Number",
    "style": "sensors_blocks",
    "tooltip": "Returns the distance measured by the proximity sensor in meters."
  },
  {
    "type": "sensor_get_infrared",
    "message0": "get infrared value",
    "output": "Number",
    "style": "sensors_blocks",
    "tooltip": "Returns the value from the infrared sensor."
  }
]);

// --- Block Generators ---
javascriptGenerator.forBlock['sensor_get_distance'] = function(_block, _generator) {
  const commandObj = {
    command: astroidV2.commands.getSensorData,
    params: {
      sensor: 'DISTANCE'
    }
  };
  const commandJsonString = JSON.stringify(commandObj);
  const commandStringLiteral = JSON.stringify(commandJsonString);
  const code = `getSensorValue(${commandStringLiteral})`;
  
  return [code, Order.FUNCTION_CALL];
};

javascriptGenerator.forBlock['sensor_get_infrared'] = function(_block, _generator) {
  const commandObj = {
    command: astroidV2.commands.getSensorData,
    params: {
      sensor: 'INFRARED'
    }
  };
  const commandStringLiteral = JSON.stringify(JSON.stringify(commandObj));
  const code = `getSensorValue(${commandStringLiteral})`;
  return [code, Order.FUNCTION_CALL];
};

// --- Toolbox Definition ---
export const sensorsCategory = {
  kind: 'category',
  name: 'Sensors',
  categorystyle: 'sensors_category',
  contents: [
    { kind: 'block', type: 'sensor_get_distance' },
    { kind: 'block', type: 'sensor_get_infrared' },
  ],
};