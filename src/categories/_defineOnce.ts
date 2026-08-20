// src/categories/_defineOnce.ts
//
// HMR-safe block registration. Next.js Fast Refresh re-executes a category
// module every time you edit it, and Blockly.defineBlocksWithJsonArray logs
// "<type> overwrites previous definition" for every block already registered.
// defineOnce() filters those out so re-runs are silent and idempotent.

import * as Blockly from 'blockly/core';

export function defineOnce(defs: any[]): void {
  const fresh = defs.filter((d) => d && d.type && !Blockly.Blocks[d.type]);
  if (fresh.length) {
    Blockly.defineBlocksWithJsonArray(fresh);
  }
}
