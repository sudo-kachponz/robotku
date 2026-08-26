// src/categories/functions_gen.ts
//
// Overrides Blockly's default JavaScript generators for the (no-return) procedure
// blocks so they emit line-delimited JSON the ProgramRunner understands, instead
// of raw JS that generateProgram() would silently drop:
//
//   procedures_defnoreturn  -> META_FUNC_DEF {name,args} ; <body> ; META_FUNC_END
//   procedures_callnoreturn -> META_CALL {name, args:[resolved values]}
//   procedures_ifreturn     -> META_RETURN {} (guarded by the block's condition)
//
// Value-returning functions (procedures_defreturn / procedures_callreturn) cannot
// be awaited inside the synchronous condition sandbox, so we deliberately do NOT
// generate JSON for them here — the a.md Functions flyout is Define + Call + Exit.

import type * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { exprOrNumber } from './_args';

const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9_]/g, '_');

function argNames(block: Blockly.Block): string[] {
  const b = block as any;
  const names: unknown = typeof b.getVars === 'function' ? b.getVars() : b.arguments_;
  return Array.isArray(names) ? names.map((n) => sanitize(String(n))) : [];
}

javascriptGenerator.forBlock['procedures_defnoreturn'] = function (block, gen) {
  const name = block.getFieldValue('NAME') || 'fungsi';
  const args = argNames(block);
  const body = (gen.statementToCode(block, 'STACK') || '')
    .split(';')
    .filter((c) => c.trim() !== '')
    .join(';');
  const def = JSON.stringify({ command: 'META_FUNC_DEF', params: { name, args } });
  const end = JSON.stringify({ command: 'META_FUNC_END', params: { name } });
  return `${def};${body ? body + ';' : ''}${end};`;
};

javascriptGenerator.forBlock['procedures_callnoreturn'] = function (block, gen) {
  const name = block.getFieldValue('NAME') || (block as any).getProcedureCall?.() || 'fungsi';
  const args: unknown[] = [];
  let i = 0;
  while (block.getInput('ARG' + i)) {
    args.push(exprOrNumber(gen.valueToCode(block, 'ARG' + i, Order.ATOMIC), 0));
    i++;
  }
  return JSON.stringify({ command: 'META_CALL', params: { name, args } }) + ';';
};

javascriptGenerator.forBlock['procedures_ifreturn'] = function (block, gen) {
  const cond = gen.valueToCode(block, 'CONDITION', Order.NONE);
  const ret = JSON.stringify({ command: 'META_RETURN', params: {} });
  if (cond) {
    return (
      JSON.stringify({ command: 'META_IF', params: { condition: cond } }) + ';' +
      ret + ';' +
      JSON.stringify({ command: 'META_END_IF', params: {} }) + ';'
    );
  }
  return ret + ';';
};
