import { describe, it, expect } from 'vitest';
import { buildProgram } from './harness';

describe('probe: headless generation', () => {
  it('generates MOVE_TIMED consistently across repeated builds', () => {
    for (let i = 0; i < 5; i++) {
      const cmds = buildProgram([{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } }]);
      expect(cmds.length, `iteration ${i} produced ${JSON.stringify(cmds)}`).toBe(1);
      expect(cmds[0]).toMatchObject({ command: 'MOVE_TIMED', params: { direction: 'forward', speed: 70 } });
    }
  });
});
