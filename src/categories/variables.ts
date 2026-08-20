// src/categories/variables.ts
//
// VARIABLES (#A16207) — a.md Variables category. Uses Blockly's dynamic
// VARIABLE flyout (create button + get/set for each variable). We override the
// set generator so it emits JSON (`META_SET_VAR`) instead of a JS assignment,
// keeping the line-delimited-JSON pipeline valid. Full interpreter support for
// variables in the simulator is a TODO.

import { javascriptGenerator, Order } from 'blockly/javascript';

javascriptGenerator.forBlock['variables_set'] = function (block, generator) {
  const name = block.getField('VAR')?.getText() ?? 'var';
  const value = generator.valueToCode(block, 'VALUE', Order.ATOMIC) || '0';
  return JSON.stringify({ command: 'META_SET_VAR', params: { name, value } }) + ';';
};

javascriptGenerator.forBlock['variables_get'] = function (block) {
  const name = block.getField('VAR')?.getText() ?? 'var';
  // Reporter: emit the (sanitised) variable name as an identifier expression.
  return [name.replace(/[^A-Za-z0-9_]/g, '_'), Order.ATOMIC];
};

export const variablesCategory = {
  kind: 'category',
  name: 'Variables',
  categorystyle: 'variable_category',
  cssconfig: { icon: 'icon-variables' },
  custom: 'VARIABLE',
};
