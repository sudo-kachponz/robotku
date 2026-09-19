// src/test/templates.connectivity.test.ts
//
// Per-template connectivity + Python coverage: for every built-in template, list the
// opcodes it emits, flag any that target hardware this board lacks (so they can't run
// on the robot), and verify it ALSO compiles to non-empty, stub-free Python — i.e. the
// template works identically in the Python code editor, not just as blocks.

import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { ensureInit } from './harness';
import { buildTemplateWorkspace } from '../templates/authoring';
import { generateProgram } from '../blockcoding/generateProgram';
import { generatePython } from '../pythongen';
import { BUILTIN_TEMPLATES } from '../templates/builtin';
import { unsupportedOpcodesInProgram } from '../blockcoding/blockOpcodes';

describe('Templates: hardware connectivity + Python parity', () => {
  ensureInit();

  for (const tpl of BUILTIN_TEMPLATES) {
    it(`${tpl.id} — opcodes + Python`, () => {
      const ws = new Blockly.Workspace();
      Blockly.serialization.workspaces.load(buildTemplateWorkspace(tpl.program) as object, ws);

      const commands = generateProgram(ws);
      const opcodes = [...new Set(commands.map((c) => c.command))];
      const absentHw = [...new Set(unsupportedOpcodesInProgram(commands))];
      const py = generatePython(ws).trim();
      ws.dispose();

      // eslint-disable-next-line no-console
      console.log(
        `  ${tpl.id.padEnd(22)} opcodes=[${opcodes.join(', ')}]` +
          `  absent-hw=[${absentHw.join(', ') || 'none — runs on robot'}]` +
          `  python=${py ? `${py.split('\n').length} lines ✅` : 'EMPTY ❌'}`,
      );

      // Every template must compile to real Python (not empty, no stub markers).
      expect(py.length, `${tpl.id}: no Python generated`).toBeGreaterThan(0);
      expect(/unknown block|TODO stub|# \?\?\?/.test(py), `${tpl.id}: Python has stubs`).toBe(false);
    });
  }
});
