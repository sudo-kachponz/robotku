// src/test/servoStep.test.ts
// Coverage + round-trip for the `servo_step` toolbox block (sim-only; no python
// surface in apiMap). Block -> command: SET_PORT with the chosen port + position.

import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { ensureInit } from './harness';
import { buildTemplateWorkspace } from '../templates/authoring';
import { generateProgram } from '../blockcoding/generateProgram';

describe('servo_step block', () => {
  const gen = (position: number) => {
    ensureInit();
    const json = buildTemplateWorkspace([
      { type: 'servo_step', fields: { PORT: 'P5' }, inputs: { POSITION: position } },
    ]);
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(json, ws);
      const cmds = generateProgram(ws) as Array<{ command?: string; params?: Record<string, unknown> }>;
      return cmds.find((c) => c.command === 'SET_PORT');
    } finally {
      ws.dispose();
    }
  };

  it('emits SET_PORT with port + value NESTED in params (what the firmware reads)', () => {
    const set = gen(90);
    expect(set?.params?.port).toBe(5);
    expect(set?.params?.value).toBe(0); // 90 deg = centre
    expect(Object.keys(set ?? {}).sort()).toEqual(['command', 'params']);
  });

  it('maps degrees 0..180 onto -100..100 and clamps', () => {
    expect(gen(0)?.params?.value).toBe(-100);
    expect(gen(180)?.params?.value).toBe(100);
    expect(gen(135)?.params?.value).toBe(50);
    expect(gen(400)?.params?.value).toBe(100);
  });
});
