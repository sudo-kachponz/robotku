// src/test/sensors.test.ts
// Parity suite for SENSORS & DATA — under the P2 board profile, Robotku V3 has NO
// sensors (no ultrasonic/light/temp/humidity/heading/distance, no touch buttons,
// no analog/digital bus). So every reporter reads inert (null → condition false)
// and every sensor statement is a logged no-op. The blocks still GENERATE their
// opcodes (kept for other board profiles); the sim just refuses to fake hardware.
//
// "Did the branch fire?" needs a SUPPORTED signal now that the gripper is inert
// too — we use a buzzer tone (PLAY_TONE), which the board really has.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun, type BlockSpec } from './harness';
import type { SimSink } from '../runtime/SimSink';

const beep: BlockSpec = {
  type: 'audio_play_tone_sec',
  fields: { NOTE: 'A4' },
  inputs: { DURATION: 0.05 },
};

/** `if <cond> then beep`. Returns true if the branch fired (buzzer sounded). */
async function branchFired(cond: BlockSpec, before?: (s: SimSink) => void): Promise<boolean> {
  const { state } = await buildAndRun(
    [{ type: 'controls_if', inputs: { IF0: cond }, statements: { DO0: [beep] } }],
    before ? { before } : undefined,
  );
  return state.buzzerHz > 0;
}

const compare = (a: BlockSpec, op: string, b: number): BlockSpec => ({
  type: 'logic_compare',
  fields: { OP: op },
  inputs: { A: a, B: b },
});

describe('Parity: Sensors & Data — reporters are inert (no sensor hardware)', () => {
  it('sensor_ultrasonic still emits the query but never fires a branch', async () => {
    const cond = compare({ type: 'sensor_ultrasonic', fields: { UNIT: 'cm', PORT: 'G1' } }, 'LT', 30);
    const cmds = buildBlock({
      type: 'controls_if',
      inputs: { IF0: cond },
      statements: { DO0: [beep] },
    } as any);
    expect(JSON.stringify(cmds)).toContain('ultrasonic'); // generator unchanged
    // An inert sensor reads as 0, so setUltrasonic() has NO effect: the branch
    // fires (or not) identically whatever we "set" — the tell that no sensor exists.
    const near = await branchFired(cond, (s) => s.setUltrasonic(10));
    const far = await branchFired(cond, (s) => s.setUltrasonic(200));
    expect(near).toBe(far);
  });

  it('sensor_is_recording never fires (no microphone)', async () => {
    const cmds = buildBlock({
      type: 'controls_if',
      inputs: { IF0: { type: 'sensor_is_recording' } },
      statements: { DO0: [beep] },
    } as any);
    expect(JSON.stringify(cmds)).toContain('recording'); // generator unchanged
    expect(await branchFired({ type: 'sensor_is_recording' })).toBe(false);
  });

  it('sensor_button1 never fires in the sim (the TOUCH 1 pad is on the robot)', async () => {
    expect(await branchFired({ type: 'sensor_button1' }, (s) => s.holdButton(1, true))).toBe(false);
  });

  it('sensor_get_analog / sensor_get_digital never fire (no I/O bus)', async () => {
    const a = compare({ type: 'sensor_get_analog', fields: { PORT: 'G1' } }, 'GT', 100);
    expect(await branchFired(a, (s) => s.setAnalogPort(0, 200))).toBe(false);
    const d = compare({ type: 'sensor_get_digital', fields: { PORT: 'G1' } }, 'EQ', 1);
    expect(await branchFired(d, (s) => s.setDigitalPort(0, true))).toBe(false);
  });

});

describe('Parity: Sensors & Data — statements are logged no-ops', () => {
  it('sensor_set_analog emits SET_ANALOG but the bus stays inert', async () => {
    const cmds = buildBlock({ type: 'sensor_set_analog', fields: { PORT: 'G3', VALUE: '180' } });
    expect(cmds[0]).toMatchObject({ command: 'SET_ANALOG', params: { port: 'G3', value: 180 } });

    const { state } = await buildAndRun([
      { type: 'sensor_set_analog', fields: { PORT: 'G3', VALUE: '180' } },
    ]);
    expect(state.analogPorts[2]).toBe(0); // inert
    expect(state.simConsole.some((m) => m.includes('SET_ANALOG'))).toBe(true);
  });

  it('sensor_set_digital emits SET_DIGITAL but the bus stays inert', async () => {
    const cmds = buildBlock({ type: 'sensor_set_digital', fields: { PORT: 'G2', VALUE: 'HIGH' } });
    expect(cmds[0]).toMatchObject({ command: 'SET_DIGITAL', params: { port: 'G2', value: 'HIGH' } });

    const { state } = await buildAndRun([
      { type: 'sensor_set_digital', fields: { PORT: 'G2', VALUE: 'HIGH' } },
    ]);
    expect(state.digitalPorts[1]).toBe(0); // inert
    expect(state.simConsole.some((m) => m.includes('SET_DIGITAL'))).toBe(true);
  });

});
