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

  it('move_steer generates STEER_TIMED; ±100 steering mirror the heading', async () => {
    const cmds = buildBlock({
      type: 'move_steer',
      fields: { STEERING: '100', SPEED: 'medium' },
      inputs: { DURATION: 0.3 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'STEER_TIMED',
      params: { steering: 100, speed: 70, left: 'P1', right: 'P2' },
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
      fields: { WHEELS: '2' },
    });
    expect(cmds[0]).toMatchObject({
      command: 'STOP',
      params: { wheels: 2, left: 'P1', right: 'P2' },
    });

    const { state } = await buildAndRun([
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } },
      { type: 'move_stop', fields: { WHEELS: '2' } },
    ]);
    expect(state.fwd).toBe(0);
    expect(state.turn).toBe(0);
    expect(state.portValues[0]).toBe(0); // M1
    expect(state.portValues[1]).toBe(0); // M2
  });

  it('servo_single drives one port then auto-stops (test servos one by one)', async () => {
    const cmds = buildBlock({ type: 'servo_single', fields: { PORT: 'P2', SPEED: 80 }, inputs: { DURATION: 0.2 } });
    expect(cmds[0]).toMatchObject({ command: 'SET_PORT', params: { port: 2, value: 80, duration_ms: 200 } });
    expect(cmds[1]).toMatchObject({ command: 'SET_PORT', params: { port: 2, value: 0 } });

    const { state } = await buildAndRun([
      { type: 'servo_single', fields: { PORT: 'P2', SPEED: 80 }, inputs: { DURATION: 0.2 } },
    ]);
    expect(state.portValues[1]).toBe(0); // ends stopped; only P2 was touched
    expect(state.portValues[0]).toBe(0); // P1 (the other servo) untouched
  });
});
