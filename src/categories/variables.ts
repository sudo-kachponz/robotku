// src/categories/variables.ts
//
// VARIABLES (#A16207) — a.md Variables category. Uses Blockly's dynamic
// VARIABLE flyout (create button + get/set for each variable). We override the
// set generator so it emits JSON (`META_SET_VAR`) instead of a JS assignment,
// keeping the line-delimited-JSON pipeline valid. Full interpreter support for
// variables in the simulator is a TODO.

import { javascriptGenerator, Order } from 'blockly/javascript';
import { exprOrLiteral } from './_args';

javascriptGenerator.forBlock['variables_set'] = function (block, generator) {
  const name = block.getField('VAR')?.getText() ?? 'var';
  // Resolve the value at RUN time (against the live scope + sensor sandbox) so
  // `set score to score + 1`, math, and reporters work — not frozen at generate.
  const value = exprOrLiteral(generator.valueToCode(block, 'VALUE', Order.ATOMIC), 0);
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
