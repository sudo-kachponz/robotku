// src/test/motion.test.ts
// Parity test suite for Motion & Actuator blocks.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun } from './harness';

describe('Parity: Motion & Actuators', () => {
  it('move_forward generates MOVE_TIMED and moves robot forward (y decreases)', async () => {
    const cmds = buildBlock({
      type: 'move_forward',
      fields: { SPEED: 'medium' },
      inputs: { DURATION: 0.5 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'MOVE_TIMED',
      params: { direction: 'forward', speed: 70 },
    });

    const { state } = await buildAndRun([
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
    ]);
    expect(state.y).toBeLessThan(0);
    expect(state.sensors.distance).toBeGreaterThan(0);
  });

  it('move_reverse generates MOVE_TIMED and moves robot backward (y increases)', async () => {
    const cmds = buildBlock({
      type: 'move_reverse',
      fields: { SPEED: 'fast' },
      inputs: { DURATION: 0.5 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'MOVE_TIMED',
      params: { direction: 'backward', speed: 100 },
    });

    const { state } = await buildAndRun([
      { type: 'move_reverse', fields: { SPEED: 'fast' }, inputs: { DURATION: 0.5 } },
    ]);
    expect(state.y).toBeGreaterThan(0);
  });

  it('move_left generates TURN_TIMED and rotates heading negatively', async () => {
    const cmds = buildBlock({
      type: 'move_left',
      fields: { SPEED: 'medium' },
      inputs: { DURATION: 0.5 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'TURN_TIMED',
      params: { direction: 'left', speed: 70 },
    });

    const { state } = await buildAndRun([
      { type: 'move_left', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
    ]);
    expect(state.headingDeg).toBeLessThan(0);
  });

  it('move_right generates TURN_TIMED and rotates heading positively', async () => {
    const cmds = buildBlock({
      type: 'move_right',
      fields: { SPEED: 'medium' },
      inputs: { DURATION: 0.5 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'TURN_TIMED',
      params: { direction: 'right', speed: 70 },
    });

    const { state } = await buildAndRun([
      { type: 'move_right', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
    ]);
    expect(state.headingDeg).toBeGreaterThan(0);
  });

  it('move_stop_all generates STOP_ALL and halts motion', async () => {
    const cmds = buildBlock({ type: 'move_stop_all' });
    expect(cmds[0]).toMatchObject({ command: 'STOP_ALL' });

    const { state } = await buildAndRun([{ type: 'move_stop_all' }]);
    expect(state.fwd).toBe(0);
    expect(state.turn).toBe(0);
  });

  // Head servo has no hardware on Robotku V3 (P2): the block still emits the opcode,
  // but the sim leaves head state at neutral and logs the ignore.
  it('mechanism_set_head emits SET_HEAD_POSITION but the sim ignores it (no head hardware)', async () => {
    const cmds = buildBlock({
      type: 'mechanism_set_head',
      fields: { PITCH: '85', YAW: '95' },
    });
    expect(cmds[0]).toMatchObject({
      command: 'SET_HEAD_POSITION',
      params: { pitch: 85, yaw: 95 },
    });

    const { state } = await buildAndRun([
      { type: 'mechanism_set_head', fields: { PITCH: '85', YAW: '95' } },
    ]);
    expect(state.headPitch).toBe(90); // unchanged — inert
    expect(state.headYaw).toBe(90);
    expect(state.simConsole.some((m) => m.includes('SET_HEAD_POSITION'))).toBe(true);
  });

  it('move_claw emits CLAW_TIMED but the sim ignores it (no gripper wired)', async () => {
    const cmds = buildBlock({
      type: 'move_claw',
      fields: { DIRECTION: 'clockwise' },
      inputs: { DURATION: 0.2 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'CLAW_TIMED',
      params: { direction: 'clockwise' },
    });

    const { state } = await buildAndRun([
      { type: 'move_claw', fields: { DIRECTION: 'clockwise' }, inputs: { DURATION: 0.2 } },
    ]);
    expect(state.gripperOpen).toBe(1); // unchanged — inert
    expect(state.simConsole.some((m) => m.includes('CLAW_TIMED'))).toBe(true);
  });

  it('move_steer generates STEER_TIMED; ±100 steering mirror the heading', async () => {
    const cmds = buildBlock({
      type: 'move_steer',
      fields: { STEERING: '100', SPEED: 'medium', LEFT: 'P1', RIGHT: 'P2' },
      inputs: { DURATION: 0.3 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'STEER_TIMED',
      params: { steering: 100, speed: 70 },
    });

    const right = await buildAndRun([
      {
        type: 'move_steer',
        fields: { STEERING: '100', SPEED: 'medium' },
        inputs: { DURATION: 0.3 },
      },
    ]);
    const left = await buildAndRun([
      {
        type: 'move_steer',
        fields: { STEERING: '-100', SPEED: 'medium' },
        inputs: { DURATION: 0.3 },
      },
    ]);
    expect(right.state.headingDeg).toBeGreaterThan(0);
    expect(left.state.headingDeg).toBeLessThan(0);
    // Mirrored steering → mirrored heading (opposite sign).
    expect(Math.sign(right.state.headingDeg)).toBe(-Math.sign(left.state.headingDeg));
  });

  it('move_stop generates STOP naming only the given ports and halts drive', async () => {
    const cmds = buildBlock({
      type: 'move_stop',
      fields: { WHEELS: '2', LEFT: 'P1', RIGHT: 'P2' },
    });
    expect(cmds[0]).toMatchObject({
      command: 'STOP',
      params: { wheels: 2, left: 'P1', right: 'P2' },
    });

    const { state } = await buildAndRun([
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } },
      { type: 'move_stop', fields: { WHEELS: '2', LEFT: 'P1', RIGHT: 'P2' } },
    ]);
    expect(state.fwd).toBe(0);
    expect(state.turn).toBe(0);
    expect(state.portValues[0]).toBe(0); // M1
    expect(state.portValues[1]).toBe(0); // M2
  });

  it('mechanism_set_gripper emits SET_GRIPPER but the sim ignores it (no gripper wired)', async () => {
    const cmds = buildBlock({ type: 'mechanism_set_gripper', fields: { STATE: 'open' } });
    expect(cmds[0]).toMatchObject({ command: 'SET_GRIPPER', params: { state: 'open' } });

    const closed = await buildAndRun([
      { type: 'mechanism_set_gripper', fields: { STATE: 'closed' } },
    ]);
    expect(closed.state.gripperOpen).toBe(1); // unchanged — inert (stays at initial open)
    expect(closed.state.simConsole.some((m) => m.includes('SET_GRIPPER'))).toBe(true);
  });
});
