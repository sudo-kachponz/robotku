// src/test/display.test.ts
// Parity test suite for Display & LED blocks.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun } from './harness';

describe('Parity: Display & LED', () => {
  it('display_matrix generates DISPLAY_MATRIX and turns on matrix LEDs', async () => {
    const cmds = buildBlock({
      type: 'display_matrix',
      fields: { PATTERN: '1111110001100011000111111' },
      inputs: { DURATION: 0.1 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'DISPLAY_MATRIX',
    });

    const { state } = await buildAndRun([
      {
        type: 'display_matrix',
        fields: { PATTERN: '1111110001100011000111111' },
        inputs: { DURATION: 0.1 },
      },
    ]);
    expect(state.matrix.some((on) => on)).toBe(true);
  });

  it('display_text generates DISPLAY_TEXT and sets state displayText', async () => {
    const cmds = buildBlock({
      type: 'display_text',
      fields: { TEXT: 'HALO ROBOTKU' },
    });
    expect(cmds[0]).toMatchObject({
      command: 'DISPLAY_TEXT',
      params: { text: 'HALO ROBOTKU' },
    });

    const { state } = await buildAndRun([
      { type: 'display_text', fields: { TEXT: 'HALO ROBOTKU' } },
    ]);
    expect(state.displayText).toBe('HALO ROBOTKU');
  });

  it('display_clear_matrix generates CLEAR_MATRIX and clears matrix LEDs', async () => {
    const { state } = await buildAndRun([
      {
        type: 'display_matrix',
        fields: { PATTERN: '1111110001100011000111111' },
        inputs: { DURATION: 0.1 },
      },
      { type: 'display_clear_matrix' },
    ]);
    expect(state.matrix.every((on) => !on)).toBe(true);
  });

  it('lcd_text generates LCD_TEXT and sets state lcdText', async () => {
    const cmds = buildBlock({
      type: 'lcd_text',
      fields: { TEXT: 'TEST LCD' },
      inputs: { DURATION: 0.1 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'LCD_TEXT',
      params: { text: 'TEST LCD' },
    });

    const { state } = await buildAndRun([
      { type: 'lcd_text', fields: { TEXT: 'TEST LCD' }, inputs: { DURATION: 0.1 } },
    ]);
    expect(state.lcdText).toBe('TEST LCD');
  });

  it('lcd_shape generates LCD_SHAPE and sets state lcdShape', async () => {
    const cmds = buildBlock({
      type: 'lcd_shape',
      fields: { SHAPE: 'heart' },
      inputs: { DURATION: 0.1 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'LCD_SHAPE',
      params: { shape: 'heart' },
    });

    const { state } = await buildAndRun([
      { type: 'lcd_shape', fields: { SHAPE: 'heart' }, inputs: { DURATION: 0.1 } },
    ]);
    expect(state.lcdShape).toBe('heart');
  });

  it('display_set_brightness generates SET_LED_BRIGHTNESS and sets state brightness', async () => {
    const cmds = buildBlock({ type: 'display_set_brightness', fields: { VALUE: '40' } });
    expect(cmds[0]).toMatchObject({
      command: 'SET_LED_BRIGHTNESS',
      params: { value: 40 },
    });

    const { state } = await buildAndRun([
      { type: 'display_set_brightness', fields: { VALUE: '40' } },
    ]);
    expect(state.brightness).toBe(40);
  });

  it('lcd_clear generates LCD_CLEAR and wipes lcdText + lcdShape', async () => {
    const cmds = buildBlock({ type: 'lcd_clear' });
    expect(cmds[0]).toMatchObject({ command: 'LCD_CLEAR' });

    const { state } = await buildAndRun([
      { type: 'lcd_text', fields: { TEXT: 'HELLO' }, inputs: { DURATION: 0.05 } },
      { type: 'lcd_shape', fields: { SHAPE: 'star' }, inputs: { DURATION: 0.05 } },
      { type: 'lcd_clear' },
    ]);
    expect(state.lcdText).toBe('');
    expect(state.lcdShape).toBeNull();
  });
});
