// src/pythongen/index.ts
//
// Wires the Robotku Python generator: registers every apiMap entry onto
// blockly/python's pythonGenerator.forBlock, leaves standard blocks (logic_*,
// math_*, text*, variables_*, procedures_*, controls_if) to Blockly's native
// Python generators, and stubs any unregistered block so a view never throws.

import type * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';
import { API } from './apiMap';

let registered = false;
export function initPythonGenerator(): void {
  if (registered) return;
  for (const entry of API) {
    pythonGenerator.forBlock[entry.block] = entry.py;
  }
  // Suppress Blockly's auto `x = None` variable prelude: our dialect assigns on
  // first use (matching the block runtime's META_SET_VAR), so the prelude would
  // add phantom commands and break parity.
  const g = pythonGenerator as unknown as {
    init: (ws: Blockly.Workspace) => void;
    definitions_?: Record<string, string>;
  };
  const origInit = g.init.bind(g);
  g.init = function (ws: Blockly.Workspace) {
    origInit(ws);
    if (g.definitions_) delete g.definitions_['variables'];
  };
  registered = true;
}

// Safe fallback for any block type present in the workspace that has neither an
// apiMap entry nor a native generator (keeps blocks->python from throwing).
function ensureStubs(workspace: Blockly.Workspace): void {
  for (const block of workspace.getAllBlocks(false)) {
    if (pythonGenerator.forBlock[block.type]) continue;
    pythonGenerator.forBlock[block.type] = (b: Blockly.Block) =>
      b.outputConnection
        ? (['0', Order.ATOMIC] as [string, number])
        : `# (blok "${b.type}" belum didukung di Python)\n`;
  }
}

export function generatePython(workspace: Blockly.Workspace): string {
  initPythonGenerator();
  ensureStubs(workspace);
  const code = pythonGenerator.workspaceToCode(workspace).trim();
  return code || '# Klik blok di panel kiri (Movement, Timing, …) untuk mulai menulis kode.';
}
