// src/test/display.test.ts
// Parity test suite for Display & LED blocks.

import { describe, it, expect } from 'vitest';
import { buildBlock, buildAndRun } from './harness';

describe('Parity: Display & LED', () => {
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

  it('display_kaomoji sends the chosen face as DISPLAY_TEXT to the OLED', async () => {
    const cmds = buildBlock({ type: 'display_kaomoji', fields: { FACE: '(^_^)' } });
    expect(cmds[0]).toMatchObject({ command: 'DISPLAY_TEXT', params: { text: '(^_^)' } });

    const { state } = await buildAndRun([{ type: 'display_kaomoji', fields: { FACE: '(>_<)' } }]);
    expect(state.displayText).toBe('(>_<)');
  });

  // No graphic LCD on Robotku V3 (P2): opcode emitted, sim ignores it.
  it('lcd_text emits LCD_TEXT but the sim ignores it (no LCD)', async () => {
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
    expect(state.lcdText).toBe(''); // inert
    expect(state.simConsole.some((m) => m.includes('LCD_TEXT'))).toBe(true);
  });

  it('lcd_shape emits LCD_SHAPE but the sim ignores it (no LCD)', async () => {
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
    expect(state.lcdShape).toBeNull(); // inert
    expect(state.simConsole.some((m) => m.includes('LCD_SHAPE'))).toBe(true);
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

  it('set_led_color generates SET_LED_COLOR and lights the sim RGB LED', async () => {
    const cmds = buildBlock({
      type: 'set_led_color',
      fields: { COLOR: '#00ff00' },
      inputs: { DURATION: 2 },
    });
    expect(cmds[0]).toMatchObject({
      command: 'SET_LED_COLOR',
      params: { r: 0, g: 255, b: 0, secs: 2 },
    });

    const { state } = await buildAndRun([
      { type: 'set_led_color', fields: { COLOR: '#ffc90e' }, inputs: { DURATION: 0.1 } },
    ]);
    expect(state.ledColor).toBe('rgb(255, 201, 14)');
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
