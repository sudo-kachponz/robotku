// src/test/sensors.test.ts
// Parity test suite for SENSORS & DATA.
//
// Reporters do not exist as standalone commands, so the honest way to test them
// is INSIDE a condition: `if <reporter> …` gates a visible action, and we assert
// whether that action fired. We use "close the gripper" as the signal — the
// gripper starts open (gripperOpen === 1) and a fired branch drives it to 0.
// Statement blocks (set/reset pin, reset distance/heading) assert SimState directly.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun, type BlockSpec } from './harness';
import type { SimSink } from '../runtime/SimSink';

const closeGripper: BlockSpec = { type: 'mechanism_set_gripper', fields: { STATE: 'closed' } };

/** `if <cond> then close gripper`. Returns true if the branch fired. */
async function branchFired(cond: BlockSpec, before?: (s: SimSink) => void): Promise<boolean> {
  const { state } = await buildAndRun(
    [{ type: 'controls_if', inputs: { IF0: cond }, statements: { DO0: [closeGripper] } }],
    before ? { before } : undefined,
  );
  return state.gripperOpen === 0;
}

const compare = (a: BlockSpec, op: string, b: number): BlockSpec => ({
  type: 'logic_compare',
  fields: { OP: op },
  inputs: { A: a, B: b },
});

describe('Parity: Sensors & Data — reporters', () => {
  it('sensor_ultrasonic gates a branch on the live distance reading', async () => {
    const cond = compare(
      { type: 'sensor_ultrasonic', fields: { UNIT: 'cm', PORT: 'G1' } },
      'LT',
      30,
    );
    // The emitted condition really queries the ultrasonic sensor.
    const cmds = buildBlock({
      type: 'controls_if',
      inputs: { IF0: cond },
      statements: { DO0: [closeGripper] },
    } as any);
    expect(JSON.stringify(cmds)).toContain('ultrasonic');

    expect(await branchFired(cond, (s) => s.setUltrasonic(10))).toBe(true);
    expect(await branchFired(cond, (s) => s.setUltrasonic(200))).toBe(false);
  });

  it('sensor_light gates on the light scalar', async () => {
    const cond = compare({ type: 'sensor_light', fields: { PORT: 'G1' } }, 'GT', 500);
    expect(await branchFired(cond, (s) => s.setSensorScalar('light', 800))).toBe(true);
    expect(await branchFired(cond, (s) => s.setSensorScalar('light', 100))).toBe(false);
  });

  it('sensor_temperature gates on the temperature scalar', async () => {
    const cond = compare({ type: 'sensor_temperature', fields: { PORT: 'G1' } }, 'GT', 30);
    expect(await branchFired(cond, (s) => s.setSensorScalar('temperature', 40))).toBe(true);
    expect(await branchFired(cond, (s) => s.setSensorScalar('temperature', 20))).toBe(false);
  });

  it('sensor_humidity gates on the humidity scalar', async () => {
    const cond = compare({ type: 'sensor_humidity', fields: { PORT: 'G1' } }, 'GT', 70);
    expect(await branchFired(cond, (s) => s.setSensorScalar('humidity', 90))).toBe(true);
    expect(await branchFired(cond, (s) => s.setSensorScalar('humidity', 40))).toBe(false);
  });

  it('sensor_button1 / sensor_button2 gate on the touch buttons', async () => {
    expect(await branchFired({ type: 'sensor_button1' }, (s) => s.holdButton(1, true))).toBe(true);
    expect(await branchFired({ type: 'sensor_button1' })).toBe(false);
    expect(await branchFired({ type: 'sensor_button2' }, (s) => s.holdButton(2, true))).toBe(true);
    expect(await branchFired({ type: 'sensor_button2' })).toBe(false);
  });

  it('sensor_is_recording gates on the recording flag (idle → does not fire)', async () => {
    const cmds = buildBlock({
      type: 'controls_if',
      inputs: { IF0: { type: 'sensor_is_recording' } },
      statements: { DO0: [closeGripper] },
    } as any);
    expect(JSON.stringify(cmds)).toContain('recording');
    // Nothing is recording during this run → branch stays closed.
    expect(await branchFired({ type: 'sensor_is_recording' })).toBe(false);
  });

  it('sensor_get_analog reads back a value set on the analog bus', async () => {
    const cond = compare({ type: 'sensor_get_analog', fields: { PORT: 'G1' } }, 'GT', 100);
    expect(await branchFired(cond, (s) => s.setAnalogPort(0, 200))).toBe(true);
    expect(await branchFired(cond, (s) => s.setAnalogPort(0, 10))).toBe(false);
  });

  it('sensor_get_digital reads back a value set on the digital bus', async () => {
    const cond = compare({ type: 'sensor_get_digital', fields: { PORT: 'G1' } }, 'EQ', 1);
    expect(await branchFired(cond, (s) => s.setDigitalPort(0, true))).toBe(true);
    expect(await branchFired(cond, (s) => s.setDigitalPort(0, false))).toBe(false);
  });

  it('sensor_distance reflects odometry accumulated by driving', async () => {
    const program = (fireCond: BlockSpec, drive: boolean): any[] => [
      ...(drive
        ? [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } }]
        : []),
      { type: 'controls_if', inputs: { IF0: fireCond }, statements: { DO0: [closeGripper] } },
    ];
    const cond = compare({ type: 'sensor_distance', fields: { PORT: 'G1' } }, 'GT', 1);
    const drove = await buildAndRun(program(cond, true));
    const idle = await buildAndRun(program(cond, false));
    expect(drove.state.gripperOpen).toBe(0); // distance > 1 after driving
    expect(idle.state.gripperOpen).toBe(1); // distance still 0
  });

  it('sensor_heading reflects the heading changed by turning', async () => {
    const cond = compare({ type: 'sensor_heading', fields: { PORT: 'G1' } }, 'GT', 5);
    const { state } = await buildAndRun([
      { type: 'move_right', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
      { type: 'controls_if', inputs: { IF0: cond }, statements: { DO0: [closeGripper] } },
    ]);
    expect(state.gripperOpen).toBe(0); // heading > 5 after a right turn
  });
});

describe('Parity: Sensors & Data — statements', () => {
  it('sensor_set_analog generates SET_ANALOG and drives the analog bus', async () => {
    const cmds = buildBlock({ type: 'sensor_set_analog', fields: { PORT: 'G3', VALUE: '180' } });
    expect(cmds[0]).toMatchObject({ command: 'SET_ANALOG', params: { port: 'G3', value: 180 } });

    const { state } = await buildAndRun([
      { type: 'sensor_set_analog', fields: { PORT: 'G3', VALUE: '180' } },
    ]);
    expect(state.analogPorts[2]).toBe(180); // G3 → index 2
  });

  it('sensor_set_digital generates SET_DIGITAL and drives the digital bus', async () => {
    const cmds = buildBlock({ type: 'sensor_set_digital', fields: { PORT: 'G2', VALUE: 'HIGH' } });
    expect(cmds[0]).toMatchObject({
      command: 'SET_DIGITAL',
      params: { port: 'G2', value: 'HIGH' },
    });

    const { state } = await buildAndRun([
      { type: 'sensor_set_digital', fields: { PORT: 'G2', VALUE: 'HIGH' } },
    ]);
    expect(state.digitalPorts[1]).toBe(1); // G2 → index 1
  });

  it('sensor_reset_distance generates RESET_DISTANCE and zeroes odometry', async () => {
    const cmds = buildBlock({ type: 'sensor_reset_distance', fields: { PORT: 'G1' } });
    expect(cmds[0]).toMatchObject({ command: 'RESET_DISTANCE', params: { port: 'G1' } });

    const { state } = await buildAndRun([
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
      { type: 'sensor_reset_distance', fields: { PORT: 'G1' } },
    ]);
    expect(state.sensors.distance).toBe(0);
  });

  it('sensor_reset_heading generates RESET_HEADING and zeroes the heading', async () => {
    const cmds = buildBlock({ type: 'sensor_reset_heading', fields: { PORT: 'G1' } });
    expect(cmds[0]).toMatchObject({ command: 'RESET_HEADING', params: { port: 'G1' } });

    const { state } = await buildAndRun([
      { type: 'move_right', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
      { type: 'sensor_reset_heading', fields: { PORT: 'G1' } },
    ]);
    expect(state.headingDeg).toBe(0);
  });
});
