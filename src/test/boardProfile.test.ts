// P0 self-check: BoardProfile is the single source of truth and HELLO_ACK overrides it.
import { describe, it, expect } from 'vitest';
import {
  robotkuEsp32V3,
  isSupported,
  portIsWired,
  profileFromHello,
} from '../domain/boardProfile';

describe('BoardProfile (P0)', () => {
  it('supports real hardware opcodes, rejects ghost ones', () => {
    expect(isSupported('MOVE_TIMED')).toBe(true);
    expect(isSupported('SET_PORT')).toBe(true);
    expect(isSupported('PLAY_TONE')).toBe(true);
    expect(isSupported('SET_LED_COLOR')).toBe(true);
    // no matrix / LCD / head servo / sensors on this board
    expect(isSupported('DISPLAY_MATRIX')).toBe(false);
    expect(isSupported('LCD_SHAPE')).toBe(false);
    expect(isSupported('SET_HEAD_POSITION')).toBe(false);
    expect(isSupported('GET_SENSOR_DATA')).toBe(false);
  });

  it('never guards host-only opcodes', () => {
    expect(isSupported('WAIT')).toBe(true);
    expect(isSupported('META_START_LOOP')).toBe(true);
    expect(isSupported('AI_CAMERA')).toBe(true);
  });

  it('reports wired ports from the static table', () => {
    expect(portIsWired(1)).toBe(true);
    expect(portIsWired(3)).toBe(false); // aux PWM, not soldered
    expect(portIsWired(8)).toBe(false); // doesn't exist
  });

  it('lets HELLO_ACK override caps and ports', () => {
    const oneServo = profileFromHello(['SET_PORT', 'STOP_ALL'], [1]);
    expect(isSupported('MOVE_TIMED', oneServo)).toBe(false);
    expect(isSupported('SET_PORT', oneServo)).toBe(true);
    expect(portIsWired(1, oneServo)).toBe(true);
    expect(portIsWired(2, oneServo)).toBe(false); // right servo not wired on bench board
  });

  it('falls back to static profile when HELLO_ACK omits fields', () => {
    const same = profileFromHello(undefined, undefined);
    expect(same.opcodes).toBe(robotkuEsp32V3.opcodes);
    expect(same.ports).toBe(robotkuEsp32V3.ports);
  });
});
