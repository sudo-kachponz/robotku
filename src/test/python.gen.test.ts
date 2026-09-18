// src/test/python.gen.test.ts
//
// Phase 2 — Blocks -> Python (faithful dialect). Guards the canonical API surface
// the compiler (Phase 3) will round-trip, and that apiMap covers every device block.

import { describe, it, expect } from 'vitest';
import * as Blockly from 'blockly';
import { ensureInit } from './harness';
import { buildTemplateWorkspace } from '../templates/authoring';
import { generatePython } from '../pythongen';
import { API_BY_BLOCK } from '../pythongen/apiMap';
import { BLOCK_OPCODE } from '../blockcoding/blockOpcodes';

function pythonFor(program: Parameters<typeof buildTemplateWorkspace>[0]): string {
  ensureInit();
  const json = buildTemplateWorkspace(program);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(json, ws);
    return generatePython(ws);
  } finally {
    ws.dispose();
  }
}

describe('apiMap coverage', () => {
  it('every block with a device opcode has an apiMap row', () => {
    const missing = Object.keys(BLOCK_OPCODE).filter((t) => !API_BY_BLOCK[t]);
    expect(missing).toEqual([]);
  });
});

describe('generatePython — faithful dialect', () => {
  it('movement + display inside repeat-forever, keyword args', () => {
    const code = pythonFor([
      {
        type: 'controls_forever',
        statements: {
          DO: [
            { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 2 } },
            { type: 'move_left', fields: { SPEED: 'fast' }, inputs: { DURATION: 1 } },
            { type: 'display_text', fields: { TEXT: 'Hi!' } },
            { type: 'move_stop', fields: { WHEELS: '2' } },
          ],
        },
      },
    ]);
    expect(code).toContain('while True:');
    expect(code).toContain('robot.forward(2, speed="medium")');
    expect(code).toContain('robot.turn("left", 1, speed="fast")');
    expect(code).toContain('display.text("Hi!")');
    expect(code).toContain('robot.stop(2)');
    expect(code).toMatch(/while True:\n\s+robot\.forward/);
  });

  it('repeat N -> for _ in range(n)', () => {
    const code = pythonFor([
      { type: 'controls_repeat_ext', inputs: { TIMES: 3 }, statements: { DO: [{ type: 'move_stop_all' }] } },
    ]);
    expect(code).toContain('for _ in range(3):');
    expect(code).toContain('robot.stop_all()');
  });

  it('sensor reporter used as an expression (wait_until)', () => {
    const code = pythonFor([
      { type: 'timing_wait_until', inputs: { CONDITION: { type: 'sensor_button1' } } },
    ]);
    expect(code).toContain('wait_until(sensors.button1())');
  });

  it('led colour keeps hex, sensor keeps port', () => {
    const code = pythonFor([
      { type: 'set_led_color', fields: { COLOR: '#ff0000' }, inputs: { DURATION: 1 } },
      { type: 'sensor_reset_heading', fields: { PORT: 'G3' } },
    ]);
    expect(code).toContain('led.color("#ff0000", 1)');
    expect(code).toContain('sensors.reset_heading("G3")');
  });

  it('escapes tricky display text (kaomoji)', () => {
    const code = pythonFor([{ type: 'display_kaomoji', fields: { FACE: '\\(^o^)/' } }]);
    expect(code).toContain('display.face("\\\\(^o^)/")');
  });
});
