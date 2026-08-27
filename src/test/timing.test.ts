// src/test/timing.test.ts
// Parity test suite for TIMING — Wait and Wait-Until.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun, buildAndStart } from './harness';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Parity: Timing', () => {
  it('timing_wait generates WAIT and blocks for the duration', async () => {
    const cmds = buildBlock({ type: 'timing_wait', inputs: { DURATION: 0.1 } });
    expect(cmds[0]).toMatchObject({ command: 'WAIT', params: { duration_ms: 100 } });

    const start = performance.now();
    const { state } = await buildAndRun([{ type: 'timing_wait', inputs: { DURATION: 0.1 } }], {
      speed: 1,
    });
    expect(performance.now() - start).toBeGreaterThanOrEqual(80);
    // Pose is untouched by a wait.
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
  });

  it('timing_wait_until generates WAIT_UNTIL and resolves when the sensor crosses the threshold', async () => {
    const cmds = buildBlock({
      type: 'timing_wait_until',
      inputs: {
        CONDITION: {
          type: 'logic_compare',
          fields: { OP: 'LT' },
          inputs: { A: { type: 'sensor_ultrasonic', fields: { UNIT: 'cm', PORT: 'G1' } }, B: 30 },
        },
      },
    });
    expect(cmds[0]).toMatchObject({ command: 'WAIT_UNTIL' });
    expect(typeof cmds[0].params.condition).toBe('string');

    // Program: wait until ultrasonic < 30, then Forward. Start far (200 → blocks),
    // then drop the reading below the threshold; the Forward must fire.
    const program = [
      {
        type: 'timing_wait_until',
        inputs: {
          CONDITION: {
            type: 'logic_compare',
            fields: { OP: 'LT' },
            inputs: { A: { type: 'sensor_ultrasonic', fields: { UNIT: 'cm', PORT: 'G1' } }, B: 30 },
          },
        },
      },
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } },
    ];

    const run = buildAndStart(program as any, { speed: 4 });
    await sleep(60);
    expect(run.sink.getState().y).toBe(0); // still waiting — hasn't moved
    run.sink.setUltrasonic(10); // sensor crosses threshold
    await run.done;
    expect(run.sink.getState().y).toBeLessThan(0); // Forward ran after the wait resolved
  });
});
