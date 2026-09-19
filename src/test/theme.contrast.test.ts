// src/test/theme.contrast.test.ts
//
// Test suite for IDE themes contrast ratios (WCAG 2.1 AA >= 4.5:1)
// and category color distinctness (DeltaE).

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { THEMES } from '../theme/themes';

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  const num = parseInt(cleaned, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const rL = srgbToLinear(r);
  const gL = srgbToLinear(g);
  const bL = srgbToLinear(b);
  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rL = srgbToLinear(r);
  const gL = srgbToLinear(g);
  const bL = srgbToLinear(b);
  const x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) / 0.95047;
  const y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) / 1.0;
  const z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) / 1.08883;
  return [x, y, z];
}

function fLab(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const [x, y, z] = rgbToXyz(r, g, b);
  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);
  return [L, a, bVal];
}

export function deltaE(hex1: string, hex2: string): number {
  const [L1, a1, b1] = hexToLab(hex1);
  const [L2, a2, b2] = hexToLab(hex2);
  return Math.sqrt(Math.pow(L1 - L2, 2) + Math.pow(a1 - a2, 2) + Math.pow(b1 - b2, 2));
}

// Helper to parse CSS variables from theme files
function parseCssVariables(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');
  const vars: Record<string, string> = {};
  const regex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cleanContent)) !== null) {
    vars[`--${match[1]}`] = match[2].trim();
  }
  return vars;
}

describe('Theme Contrast & Color Distinction Suite', () => {
  const themeCssDir = path.resolve(__dirname, '../theme/themes');

  THEMES.forEach((theme) => {
    describe(`Theme: ${theme.name} (${theme.id})`, () => {
      it('category colors have >= 4.5:1 contrast against the surface/background', () => {
        const cssFile = path.join(themeCssDir, `${theme.id}.css`);
        const vars = parseCssVariables(cssFile);
        const surface = vars['--surface'] || (theme.mode === 'dark' ? '#131826' : '#FFFFFF');
        const bgToCheck = theme.mode === 'dark' ? surface : '#FFFFFF';

        Object.entries(theme.categoryColors).forEach(([cat, colorHex]) => {
          const ratio = contrastRatio(bgToCheck, colorHex);
          expect(
            ratio,
            `Category "${cat}" (${colorHex}) in theme "${theme.id}" should have contrast >= 4.5:1 against ${bgToCheck}, got ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      });

      it('--ink-700 has >= 4.5:1 contrast against --surface', () => {
        const cssFile = path.join(themeCssDir, `${theme.id}.css`);
        const vars = parseCssVariables(cssFile);
        const surface = vars['--surface'];
        const ink700 = vars['--ink-700'];

        expect(surface, `Theme ${theme.id} must define --surface`).toBeDefined();
        expect(ink700, `Theme ${theme.id} must define --ink-700`).toBeDefined();

        const ratio = contrastRatio(surface, ink700);
        expect(
          ratio,
          `--ink-700 (${ink700}) vs --surface (${surface}) in "${theme.id}" must be >= 4.5:1, got ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      });

      it('--code-fg has >= 4.5:1 contrast against --code-bg', () => {
        const cssFile = path.join(themeCssDir, `${theme.id}.css`);
        const vars = parseCssVariables(cssFile);
        const codeBg = vars['--code-bg'];
        const codeFg = vars['--code-fg'];

        expect(codeBg, `Theme ${theme.id} must define --code-bg`).toBeDefined();
        expect(codeFg, `Theme ${theme.id} must define --code-fg`).toBeDefined();

        const ratio = contrastRatio(codeBg, codeFg);
        expect(
          ratio,
          `--code-fg (${codeFg}) vs --code-bg (${codeBg}) in "${theme.id}" must be >= 4.5:1, got ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      });

      it('each pair of categories has distinguishable color distance (DeltaE >= 8.0)', () => {
        const categories = Object.entries(theme.categoryColors);
        for (let i = 0; i < categories.length; i++) {
          for (let j = i + 1; j < categories.length; j++) {
            const [catA, colorA] = categories[i];
            const [catB, colorB] = categories[j];
            const dE = deltaE(colorA, colorB);
            expect(
              dE,
              `Categories "${catA}" (${colorA}) and "${catB}" (${colorB}) in "${theme.id}" should have DeltaE >= 8.0, got ${dE.toFixed(2)}`,
            ).toBeGreaterThanOrEqual(8.0);
          }
        }
      });
    });
  });
});
