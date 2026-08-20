// src/categories/templates.ts
//
// TEMPLATES (#CA8A04) — a.md Templates category. A collapsible comment block
// plus a home for user-saved snippets (Projects/Templates store, TODO). The
// comment block generates no command (it is documentation only).

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator } from 'blockly/javascript';

defineOnce([
  {
    "type": "templates_comment",
    "message0": "note %1",
    "args0": [{ "type": "field_input", "name": "TEXT", "text": "a comment" }],
    "previousStatement": null, "nextStatement": null, "style": "templates_blocks",
    "inputsInline": true,
    "tooltip": "A comment for humans — does nothing on the robot."
  }
]);

// Comments emit no command.
javascriptGenerator.forBlock['templates_comment'] = function () {
  return '';
};

export const templatesCategory = {
  kind: 'category',
  name: 'Templates',
  categorystyle: 'templates_category',
  cssconfig: { icon: 'icon-templates' },
  contents: [
    { kind: 'label', text: 'Templates' },
    { kind: 'block', type: 'templates_comment' },
  ],
};
