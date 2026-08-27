// src/categories/_args.ts
//
// The run-time-expression contract. Block generators used to freeze numeric
// inputs with `parseFloat(valueToCode(...))`, so ANY non-constant input (a
// variable, a Math block, a Sensor reporter) collapsed to NaN → a 0.1 s default.
// That silently broke whole categories.
//
// numArg/strArg keep constant inputs BYTE-IDENTICAL (a plain number/string) but
// wrap non-constant inputs as `{ $expr: "<js>" }`, which ProgramRunner resolves
// against the live variable scope + sensor sandbox right before exec(). The
// firmware never sees `$expr` — TransportSink only ever receives resolved
// literals.

import type * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';

export type NumOrExpr = number | { $expr: string };
export type StrOrExpr = string | { $expr: string };

/** Turn a `valueToCode` result into a literal when constant, else an $expr. */
export function exprOrNumber(code: string | null | undefined, fallback: number): NumOrExpr {
  if (code == null || code.trim() === '') return fallback;
  const n = Number(code);
  if (Number.isFinite(n)) return n;
  return { $expr: code };
}

/** Numeric value input → number (constant) or `{ $expr }` (resolved at run time). */
export function numArg(
  block: Blockly.Block,
  gen: typeof javascriptGenerator,
  inputName: string,
  fallback = 1,
): NumOrExpr {
  return exprOrNumber(gen.valueToCode(block, inputName, Order.ATOMIC), fallback);
}

/** Multiply a NumOrExpr by a constant factor, preserving the $expr form. */
export function mulNum(v: NumOrExpr, k: number): NumOrExpr {
  if (typeof v === 'number') return v * k;
  return { $expr: `(${v.$expr})*${k}` };
}

/** Text value input → string (constant) or `{ $expr }`. */
export function strArg(
  block: Blockly.Block,
  gen: typeof javascriptGenerator,
  inputName: string,
  fallback = '',
): StrOrExpr {
  const code = gen.valueToCode(block, inputName, Order.NONE);
  if (code == null || code.trim() === '') return fallback;
  // A plain quoted string literal → unwrap to the constant (byte-identical).
  const m = /^'((?:[^'\\]|\\.)*)'$/.exec(code.trim()) || /^"((?:[^"\\]|\\.)*)"$/.exec(code.trim());
  if (m) {
    try {
      return JSON.parse(`"${m[1].replace(/"/g, '\\"')}"`);
    } catch {
      return m[1];
    }
  }
  return { $expr: code };
}

/** A raw generator-string (variables_set VALUE) → literal or `{ $expr }`. */
export function exprOrLiteral(
  code: string | null | undefined,
  fallback: number | string = 0,
): NumOrExpr | StrOrExpr {
  if (code == null || code.trim() === '') return fallback as NumOrExpr;
  const n = Number(code);
  if (Number.isFinite(n)) return n;
  const trimmed = code.trim();
  const m = /^'((?:[^'\\]|\\.)*)'$/.exec(trimmed) || /^"((?:[^"\\]|\\.)*)"$/.exec(trimmed);
  if (m) return m[1];
  return { $expr: code };
}
