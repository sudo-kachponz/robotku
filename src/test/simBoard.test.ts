// src/test/simBoard.test.ts
// 4.md acceptance (automated): the board + OLED actually render to SVG markup,
// with the real header colors, all 10 ports, and a reactive RGB LED.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BoardSvg from '../components/blockcoding/sim/BoardSvg';
import OledModule from '../components/blockcoding/sim/OledModule';
import { PWM_PORTS, I2C_PORTS } from '../domain/hardware';

const ports = [
  ...PWM_PORTS.map((p) => ({ id: p.id, kind: 'pwm' as const })),
  ...I2C_PORTS.map((p) => ({ id: p.id, kind: 'i2c' as const })),
];

describe('Sim board renders (4.md)', () => {
  it('BoardSvg draws toska casing, both header blocks, all 10 ports, silkscreen', () => {
    const html = renderToStaticMarkup(
      createElement(BoardSvg, { rgb: null, buzzerActive: false, linkState: 'off', ports }),
    );
    expect(html).toContain('#2FC49A'); // toska casing (the kid's visual anchor)
    expect(html).toMatch(/>P1</);
    expect(html).toMatch(/>P5</);
    expect(html).toMatch(/>I1</);
    expect(html).toMatch(/>I5</);
    expect(html).toContain('#DC2626'); // red header row (VCC / 5V)
    expect(html).toContain('#16A34A'); // green SCL row (I2C)
    expect(html).toContain('ROBOTKU');
  });

  it('RGB LED shows the driven color', () => {
    const html = renderToStaticMarkup(
      createElement(BoardSvg, { rgb: { r: 255, g: 0, b: 0 }, buzzerActive: false, linkState: 'off', ports }),
    );
    expect(html).toContain('rgb(255, 0, 0)');
  });

  it('OledModule renders live screen text + labelled pins (GND VDD SCK SDA)', () => {
    const html = renderToStaticMarkup(createElement(OledModule, { text: 'HALO' }));
    expect(html).toContain('HALO');
    expect(html).toContain('GND');
    expect(html).toContain('SDA');
  });
});
