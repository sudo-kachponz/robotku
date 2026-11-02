// src/test/servoStep.test.ts
// Coverage + round-trip for the `servo_step` toolbox block (sim-only; no python
// surface in apiMap). Block -> command: SET_PORT with the chosen port + position.

import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { ensureInit } from './harness';
import { buildTemplateWorkspace } from '../templates/authoring';
import { generateProgram } from '../blockcoding/generateProgram';

describe('servo_step block', () => {
  it('emits SET_PORT with the selected port + position', () => {
    ensureInit();
    const json = buildTemplateWorkspace([
      { type: 'servo_step', fields: { PORT: 'P1' }, inputs: { POSITION: 90 } },
    ]);
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(json, ws);
      const cmds = generateProgram(ws) as Array<Record<string, unknown>>;
      const set = cmds.find((c) => c.command === 'SET_PORT');
      expect(set).toBeTruthy();
      expect(set?.port).toBe(1);
      expect(set?.value).toBe(90);
    } finally {
      ws.dispose();
    }
  });
});
