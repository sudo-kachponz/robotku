// src/categories/operators.ts
import { javascriptGenerator, Order } from 'blockly/javascript';

// --- JavaScript Generators for Standard Blocks ---
javascriptGenerator.forBlock['text'] = function(block) {
  const textValue = block.getFieldValue('TEXT');
  const code = JSON.stringify(textValue);
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['math_number'] = function(block) {
  const code = String(block.getFieldValue('NUM'));
  return [code, Order.ATOMIC];
};

javascriptGenerator.forBlock['logic_compare'] = function(block) {
  const OPERATORS: { [key: string]: string } = { 'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 'GT': '>', 'GTE': '>=' };
  const operator = OPERATORS[block.getFieldValue('OP')];
  const order = Order.RELATIONAL;
  const argument0 = javascriptGenerator.valueToCode(block, 'A', order) || '0';
  const argument1 = javascriptGenerator.valueToCode(block, 'B', order) || '0';
  const code = `${argument0} ${operator} ${argument1}`;
  return [code, order];
};

javascriptGenerator.forBlock['logic_operation'] = function(block) {
  const operator = (block.getFieldValue('OP') === 'AND') ? '&&' : '||';
  const order = (operator === '&&') ? Order.LOGICAL_AND : Order.LOGICAL_OR;
  let argument0 = javascriptGenerator.valueToCode(block, 'A', order) || 'false';
  let argument1 = javascriptGenerator.valueToCode(block, 'B', order) || 'false';
  const code = `${argument0} ${operator} ${argument1}`;
  return [code, order];
};

javascriptGenerator.forBlock['logic_negate'] = function(block) {
  const order = Order.LOGICAL_NOT;
  const argument0 = javascriptGenerator.valueToCode(block, 'BOOL', order) || 'true';
  const code = `!${argument0}`;
  return [code, order];
};

// --- Toolbox Category Definition ---
export const operatorsCategory = {
  kind: 'category',
  name: 'Operators',
  categorystyle: 'operators_category',
  contents: [
    // --- Math Blocks ---
    { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
    {
      kind: 'block', type: 'math_arithmetic',
      inputs: {
        A: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        B: { shadow: { type: 'math_number', fields: { NUM: 1 } } }
      }
    },
    {
      kind: 'block', type: 'math_random_int',
      inputs: {
        FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        TO: { shadow: { type: 'math_number', fields: { NUM: 100 } } }
      }
    },
    { kind: 'sep', gap: 24 },
    // --- Logic Blocks ---
    { kind: 'block', type: 'logic_compare' },
    { kind: 'block', type: 'logic_operation' },
    { kind: 'block', type: 'logic_negate' },
    { kind: 'block', type: 'logic_boolean' },
    { kind: 'sep', gap: 24 },
    // --- Text Blocks ---
    { kind: 'block', type: 'text', fields: { TEXT: 'hello world' } },
    { kind: 'block', type: 'text_join' },
  ],
};