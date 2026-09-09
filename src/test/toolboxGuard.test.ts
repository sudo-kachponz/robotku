// P1 self-check: the toolbox guard disables ghost-hardware blocks and HELLO_ACK
// re-guards live. Also checks the program-level unsupported-opcode helper.
import { describe, it, expect } from 'vitest';
import '../categories'; // side-effect: register block definitions + generators
import { getAstroidToolbox } from '../toolbox';
import { profileFromHello } from '../domain/boardProfile';
import { unsupportedOpcodesInProgram } from '../blockcoding/blockOpcodes';

function findBlock(item: any, type: string): any {
  if (item?.kind === 'block' && item.type === type) return item;
  if (item?.contents) {
    for (const c of item.contents) {
      const hit = findBlock(c, type);
      if (hit) return hit;
    }
  }
  return null;
}

function isDisabled(toolbox: any, type: string): boolean {
  const found = toolbox.contents.map((c: any) => findBlock(c, type)).find(Boolean);
  return Boolean(found?.disabled);
}

describe('toolbox guard (P1)', () => {
  it('disables ghost-hardware blocks on the default profile', () => {
    const tb = getAstroidToolbox();
    expect(isDisabled(tb, 'lcd_shape')).toBe(true); // no graphic LCD
    expect(isDisabled(tb, 'sensor_ultrasonic')).toBe(true); // no sensors
    // real hardware stays enabled
    expect(isDisabled(tb, 'move_forward')).toBe(false);
    expect(isDisabled(tb, 'audio_play_tone_sec')).toBe(false);
    // host/meta blocks are never touched
    expect(isDisabled(tb, 'controls_if')).toBe(false);
  });

  it('re-guards live from HELLO_ACK (one-servo bench board can not turn)', () => {
    const oneServo = profileFromHello(['SET_PORT', 'STOP_ALL', 'MOVE_TIMED', 'PLAY_TONE'], [1]);
    const tb = getAstroidToolbox(oneServo);
    expect(isDisabled(tb, 'move_left')).toBe(true); // TURN_TIMED not advertised
    expect(isDisabled(tb, 'move_forward')).toBe(false); // MOVE_TIMED still there
  });

  it('flags unsupported opcodes in a generated program', () => {
    const bad = unsupportedOpcodesInProgram([
      { command: 'MOVE_TIMED' },
      { command: 'DISPLAY_MATRIX' },
      { command: 'WAIT' },
    ]);
    expect(bad).toEqual(['DISPLAY_MATRIX']);
  });
});
