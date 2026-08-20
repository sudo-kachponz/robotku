// src/categories/math.ts
//
// MATH (#4F46E5) — a.md Math category (reskinned Blockly math value blocks).
// Standard Blockly JS generators produce expressions used inside number inputs
// and conditions; math_number is overridden to be atomic in operators.ts.

export const mathCategory = {
  kind: 'category',
  name: 'Math',
  categorystyle: 'math_category',
  cssconfig: { icon: 'icon-math' },
  contents: [
    { kind: 'label', text: 'Math' },
    { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
    {
      kind: 'block', type: 'math_arithmetic',
      inputs: {
        A: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        B: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
      },
    },
    {
      kind: 'block', type: 'math_modulo',
      inputs: {
        DIVIDEND: { shadow: { type: 'math_number', fields: { NUM: 64 } } },
        DIVISOR: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
      },
    },
    { kind: 'block', type: 'math_constant' },
    {
      kind: 'block', type: 'math_single',
      inputs: { NUM: { shadow: { type: 'math_number', fields: { NUM: 9 } } } },
    },
    {
      kind: 'block', type: 'math_round',
      inputs: { NUM: { shadow: { type: 'math_number', fields: { NUM: 3.1 } } } },
    },
    {
      kind: 'block', type: 'math_random_int',
      inputs: {
        FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        TO: { shadow: { type: 'math_number', fields: { NUM: 100 } } },
      },
    },
  ],
};
