// src/categories/ai.ts
//
// AI (#EC2D8F) — a.md experimental ("Eksperimen") stub category. These blocks
// are wired to the AI camera button as no-op placeholders; they are clearly
// future work and must not block the build.

import * as Blockly from 'blockly/core';
import { defineOnce } from './_defineOnce';
import { javascriptGenerator, Order } from 'blockly/javascript';

defineOnce([
  {
    "type": "ai_object_detected",
    "message0": "AI: object %1 detected?",
    "args0": [{ "type": "field_input", "name": "LABEL", "text": "ball" }],
    "output": "Boolean", "style": "ai_blocks", "inputsInline": true,
    "tooltip": "Experimental — always false until the AI camera is wired up."
  },
  {
    "type": "ai_capture_frame",
    "message0": "AI: capture frame",
    "previousStatement": null, "nextStatement": null, "style": "ai_blocks",
    "tooltip": "Experimental — placeholder for the AI camera capture."
  }
]);

javascriptGenerator.forBlock['ai_object_detected'] = function () {
  return ['false', Order.ATOMIC];
};

javascriptGenerator.forBlock['ai_capture_frame'] = function () {
  return JSON.stringify({ command: 'AI_CAPTURE', params: {} }) + ';';
};

export const aiCategory = {
  kind: 'category',
  name: 'AI',
  categorystyle: 'ai_category',
  cssconfig: { icon: 'icon-ai' },
  contents: [
    { kind: 'label', text: 'AI' },
    { kind: 'label', text: 'Eksperimen' },
    { kind: 'block', type: 'ai_object_detected' },
    { kind: 'block', type: 'ai_capture_frame' },
  ],
};
