// src/categories/logic.ts
//
// LOGIC (#0D9488) — a.md Logic category (reskinned Blockly logic value blocks).
// The JS generators for these blocks are the standard ones (see operators.ts),
// which emit plain expressions the sequencer evaluates inside conditions.

export const logicCategory = {
  kind: 'category',
  name: 'Logic',
  categorystyle: 'logic_category',
  cssconfig: { icon: 'icon-logic' },
  contents: [
    { kind: 'label', text: 'Logic' },
    { kind: 'block', type: 'logic_compare' },
    { kind: 'block', type: 'logic_operation' },
    { kind: 'block', type: 'logic_negate' },
    { kind: 'block', type: 'logic_boolean' },
  ],
};
