// src/categories/templates.ts
//
// TEMPLATES (#CA8A04) — a.md Templates category. The rich experience is the modal
// gallery (TemplateGallery.tsx); this Blockly category is the SECONDARY surface:
// a custom flyout with a "Buka Galeri Template" button and the comment block.
// (We deliberately do NOT render the whole gallery inside a Blockly flyout.)

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator } from 'blockly/javascript';
import { openTemplateGallery } from '../templates/galleryBridge';

defineOnce([
  {
    type: 'templates_comment',
    message0: 'note %1',
    args0: [{ type: 'field_input', name: 'TEXT', text: 'a comment' }],
    previousStatement: null,
    nextStatement: null,
    style: 'templates_blocks',
    inputsInline: true,
    tooltip: 'A comment for humans — does nothing on the robot.',
  },
]);

// Comments emit no command.
javascriptGenerator.forBlock['templates_comment'] = function () {
  return '';
};

const OPEN_GALLERY_KEY = 'OPEN_TEMPLATE_GALLERY';
const FLYOUT_KEY = 'TEMPLATES_FLYOUT';

/** Populate the Templates flyout: a gallery button + the comment block. */
function templatesFlyout(): Blockly.utils.toolbox.FlyoutItemInfoArray {
  return [
    { kind: 'button', text: '✨  Buka Galeri Template', callbackkey: OPEN_GALLERY_KEY },
    { kind: 'label', text: 'Catatan' },
    { kind: 'block', type: 'templates_comment' },
  ] as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

/**
 * Wire the Templates flyout + its "open gallery" button onto a live workspace.
 * Called once from useBlocklyWorkspace after Blockly.inject().
 */
export function registerTemplatesFlyout(workspace: Blockly.WorkspaceSvg): void {
  workspace.registerToolboxCategoryCallback(FLYOUT_KEY, templatesFlyout);
  workspace.registerButtonCallback(OPEN_GALLERY_KEY, () => openTemplateGallery());
}

export const templatesCategory = {
  kind: 'category',
  name: 'Templates',
  categorystyle: 'templates_category',
  cssconfig: { icon: 'icon-templates' },
  custom: FLYOUT_KEY,
};
