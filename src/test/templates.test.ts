// src/test/templates.test.ts
// Parity test suite for TEMPLATES — the comment block emits no command but must
// not break a program that surrounds it.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun } from './harness';

describe('Parity: Templates', () => {
  it('templates_comment emits no command', () => {
    const cmds = buildBlock({ type: 'templates_comment', fields: { TEXT: 'langkah 1' } });
    expect(cmds).toEqual([]);
  });

  it('a comment between two statements is invisible to the runtime', async () => {
    const { state, log } = await buildAndRun([
      { type: 'templates_comment', fields: { TEXT: 'mulai' } },
      { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } },
      { type: 'templates_comment', fields: { TEXT: 'selesai' } },
    ]);
    expect(log.filter((c) => c.command === 'MOVE_TIMED').length).toBe(1);
    expect(state.y).toBeLessThan(0);
  });
});
