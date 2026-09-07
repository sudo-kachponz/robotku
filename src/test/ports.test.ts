// src/test/ports.test.ts
// Slice 1+2: the real board is 5 PWM + 5 I2C ports, not 8 generic M/G slots.

import { describe, it, expect } from 'vitest';
import { portIndex, i2cIndex, portLabel, NUM_PWM_PORTS, NUM_I2C_PORTS } from '../domain/ports';
import { PWM_PORTS, I2C_PORTS, BOARD_PINS } from '../domain/hardware';

describe('Port model — 5 PWM + 5 I2C (Controller V3)', () => {
  it('has 5 PWM and 5 I2C ports', () => {
    expect(NUM_PWM_PORTS).toBe(5);
    expect(NUM_I2C_PORTS).toBe(5);
  });

  it('portIndex maps P1..P5 and bare 1..5 to slots 0..4; rejects out-of-range', () => {
    expect(portIndex('P1')).toBe(0);
    expect(portIndex('P5')).toBe(4);
    expect(portIndex(2)).toBe(1);
    expect(portIndex('P6')).toBeNull();
    expect(portIndex(6)).toBeNull(); // old G6..G8 range no longer exists
  });

  it('migrates legacy motor ports M1..M4 -> P1..P4', () => {
    expect(portIndex('M1')).toBe(0);
    expect(portIndex('M4')).toBe(3);
  });

  it('i2cIndex maps I1..I5, migrates G1..G5, and drops G6..G8', () => {
    expect(i2cIndex('I1')).toBe(0);
    expect(i2cIndex('I5')).toBe(4);
    expect(i2cIndex('G3')).toBe(2);
    expect(i2cIndex('G6')).toBeNull(); // no equivalent on this board
    expect(i2cIndex('I6')).toBeNull();
  });

  it('labels read "P1 · PWM" / "I1 · I2C"', () => {
    expect(portLabel(0)).toBe('P1 · PWM');
    expect(portLabel(0, 'i2c')).toBe('I1 · I2C');
  });

  it('only physically-verified GPIOs carry a number (P3..P5 stay TODO)', () => {
    expect(PWM_PORTS[0].gpio).toBe(33); // servo left, proven
    expect(PWM_PORTS[1].gpio).toBe(25); // servo right, proven
    expect(PWM_PORTS[2].gpio).toBeUndefined();
    expect(PWM_PORTS[2].verified).toBe(false);
    expect(BOARD_PINS.buzzer.gpio).toBe(13);
    expect(BOARD_PINS.rgbLed).toMatchObject({ r: 16, g: 17, b: 5 });
    expect(I2C_PORTS).toHaveLength(5); // one shared bus, 5 connectors
  });
});
