// src/categories/events.ts

import * as Blockly from 'blockly/core';

Blockly.defineBlocksWithJsonArray([
  {
    "type": "program_start",
    "message0": "When Adventure Starts",
    "nextStatement": null,
    "style": "events_blocks",
    "tooltip": "This block is the starting point for your adventure."
  }
]);

export const eventsCategory = {
  kind: 'category',
  name: 'Events',
  categorystyle: 'events_category',
  contents: [
    {
      kind: 'block',
      type: 'program_start'
    },
  ],
};