import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';

Blockly.defineBlocksWithJsonArray([
  {
    "type": "controls_repeat_ext",
    "message0": "repeat %1 times",
    "args0": [
      {
        "type": "input_value",
        "name": "TIMES",
        "check": "Number",
        "shadow": {
          "type": "math_number",
          "fields": {
            "NUM": 10
          }
        }
      }
    ],
    "message1": "do %1",
    "args1": [
      {
        "type": "input_statement",
        "name": "DO"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "control_blocks",
    "tooltip": "Repeat the enclosed blocks a number of times."
  },
  {
    "type": "controls_forever",
    "message0": "repeat forever",
    "message1": "do %1",
    "args1": [
      {
        "type": "input_statement",
        "name": "DO"
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "control_blocks",
    "tooltip": "Repeat the enclosed blocks forever until stopped."
  },
  {
    "type": "controls_wait",
    "message0": "wait %1 seconds",
    "args0": [
      {
        "type": "field_number",
        "name": "DURATION",
        "value": 1,
        "min": 0,
        "precision": 0.1
      }
    ],
    "previousStatement": null,
    "nextStatement": null,
    "style": "control_blocks",
    "tooltip": "Waits for a specified amount of time before continuing."
  },
  {
    "type": "controls_break",
    "message0": "break out of loop",
    "previousStatement": null,
    "style": "control_blocks",
    "tooltip": "Exits the current repeat loop.",
  }
]);

javascriptGenerator.forBlock['controls_repeat_ext'] = function(block, generator) {
  const repeats = generator.valueToCode(block, 'TIMES', Order.ATOMIC) || '10';
  const branch = generator.statementToCode(block, 'DO') || '';
  
  const startLoopCmd = JSON.stringify({
    command: 'META_START_LOOP',
    params: { times: parseInt(repeats, 10) }
  });
  
  const endLoopCmd = JSON.stringify({
    command: 'META_END_LOOP',
    params: {}
  });

  const branchCommands = branch.split(';').filter(c => c.trim() !== '').join(';');
  const code = `${startLoopCmd};${branchCommands ? branchCommands + ';' : ''}${endLoopCmd};`;
  return code;
};

javascriptGenerator.forBlock['controls_forever'] = function(block, generator) {
  const branch = generator.statementToCode(block, 'DO') || '';

  const startLoopCmd = JSON.stringify({
    command: 'META_START_INFINITE_LOOP',
    params: {}
  });

  const endLoopCmd = JSON.stringify({
    command: 'META_END_LOOP',
    params: {}
  });

  const branchCommands = branch.split(';').filter(c => c.trim() !== '').join(';');
  const code = `${startLoopCmd};${branchCommands ? branchCommands + ';' : ''}${endLoopCmd};`;
  return code;
};

javascriptGenerator.forBlock['controls_wait'] = function(block, _generator) {
  const durationInSeconds = Number(block.getFieldValue('DURATION'));
  const durationInMs = durationInSeconds * 1000;
  
  const waitCmd = JSON.stringify({
    command: 'WAIT',
    params: { duration_ms: durationInMs }
  });

  return `${waitCmd};`;
};

javascriptGenerator.forBlock['controls_if'] = function(block, generator) {
  let code = '';
  let n = 0;

  do {
    const conditionCode = generator.valueToCode(block, 'IF' + n, Order.NONE) || 'false';
    const branchCode = generator.statementToCode(block, 'DO' + n) || '';
    
    const metaIfCmd = JSON.stringify({
      command: n === 0 ? 'META_IF' : 'META_ELSE_IF',
      params: { condition: conditionCode }
    });

    code += metaIfCmd + ';';
    if (branchCode) {
      code += branchCode;
    }
    n++;
  } while (block.getInput('IF' + n));

  if (block.getInput('ELSE')) {
    const branchCode = generator.statementToCode(block, 'ELSE') || '';
    const metaElseCmd = JSON.stringify({ command: 'META_ELSE', params: {} });
    code += metaElseCmd + ';';
    if (branchCode) {
      code += branchCode;
    }
  }

  const metaEndIfCmd = JSON.stringify({ command: 'META_END_IF', params: {} });
  code += metaEndIfCmd + ';';
  
  return code;
};

javascriptGenerator.forBlock['controls_break'] = function(_block, _generator) {
  const breakCmd = JSON.stringify({
    command: 'META_BREAK_LOOP',
    params: {}
  });
  return `${breakCmd};`;
};

export const controlCategory = {
  kind: 'category',
  name: 'Control',
  categorystyle: 'control_category',
  contents: [
    { kind: 'block', type: 'controls_wait' },
    {
      kind: 'block',
      type: 'controls_repeat_ext',
      inputs: {
        TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } }
      }
    },
    {
      kind: 'block',
      type: 'controls_forever'
    },
    {
      kind: 'block',
      type: 'controls_if',
      extraState: {
        hasElse: true
      }
    },
    {
      kind: 'block',
      type: 'controls_break'
    }
  ],
};