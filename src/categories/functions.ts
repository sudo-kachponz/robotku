// src/categories/functions.ts
//
// FUNCTIONS (#565386) — a.md Functions category. Uses Blockly's dynamic
// PROCEDURE flyout (Define blocks + call blocks appear under "Your Functions"
// once a Define block is on the workspace). Interpreter support for calling
// user functions in the simulator is a TODO; the definitions still serialise
// and stream as structure.

export const functionsCategory = {
  kind: 'category',
  name: 'Functions',
  categorystyle: 'procedure_category',
  cssconfig: { icon: 'icon-functions' },
  custom: 'PROCEDURE',
};
