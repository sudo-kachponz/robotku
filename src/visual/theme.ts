import * as Blockly from 'blockly/core';
import { jakarta } from '../theme/fonts';
import { getTheme } from '../theme/themes';

// --- Helper: lighten/darken a hex colour for secondary/tertiary shades ---
function adjust(hex: string, amount: number): string {
  const color = Blockly.utils.colour.hexToRgb(hex);
  if (!color) return hex;
  const a = Math.max(-1, Math.min(1, amount));
  const blend = (c: number) => {
    const v = a >= 0 ? c + (255 - c) * a : c * (1 + a);
    return Math.round(Math.min(255, Math.max(0, v)));
  };
  return Blockly.utils.colour.rgbToHex(blend(color[0]), blend(color[1]), blend(color[2]));
}

const fontStyle: Blockly.Theme.FontStyle = {
  family: `${jakarta.style.fontFamily}, system-ui, -apple-system, sans-serif`,
  weight: '600',
  size: 14,
};

const THEME_CACHE = new Map<string, Blockly.Theme>();

export function getRobotkuTheme(themeId: string = 'robotku'): Blockly.Theme {
  const tid = themeId || 'robotku';
  if (THEME_CACHE.has(tid)) {
    return THEME_CACHE.get(tid)!;
  }

  const def = getTheme(tid);
  const isDark = def.mode === 'dark';

  const catMap: Record<string, string> = {
    motors: def.categoryColors.Movement,
    events: def.categoryColors.Timing,
    looks: def.categoryColors.Display,
    audio: def.categoryColors.Audio,
    sensors: def.categoryColors['Sensors & Data'],
    control: def.categoryColors['Program Flow'],
    loop: def.categoryColors['Program Flow'],
    logic: def.categoryColors.Logic,
    math: def.categoryColors.Math,
    variable: def.categoryColors.Variables,
    procedure: def.categoryColors.Functions,
    text: def.categoryColors.Display,
    templates: def.categoryColors.Templates,
    ai: def.categoryColors.AI,
  };

  const blockStyles: { [key: string]: Blockly.Theme.BlockStyle } = {};
  const categoryStyles: { [key: string]: Blockly.Theme.CategoryStyle } = {};

  for (const key in catMap) {
    const primary = catMap[key];
    blockStyles[`${key}_blocks`] = {
      colourPrimary: primary,
      colourSecondary: adjust(primary, isDark ? 0.2 : 0.15),
      colourTertiary: adjust(primary, isDark ? -0.2 : -0.15),
      hat: '',
    };
    categoryStyles[`${key}_category`] = { colour: primary };
  }

  blockStyles.hat_blocks = {
    colourPrimary: def.categoryColors.Timing,
    colourSecondary: adjust(def.categoryColors.Timing, 0.15),
    colourTertiary: adjust(def.categoryColors.Timing, -0.15),
    hat: 'cap',
  };

  const compStyles: Blockly.Theme.ComponentStyle = isDark
    ? {
        workspaceBackgroundColour: def.swatch[2] || '#0B0F19',
        toolboxBackgroundColour: def.swatch[2] || '#131826',
        toolboxForegroundColour: '#E2E8F0',
        flyoutBackgroundColour: def.swatch[2] || '#1C2438',
        flyoutForegroundColour: '#E2E8F0',
        flyoutOpacity: 0.95,
        scrollbarColour: '#475569',
        scrollbarOpacity: 0.7,
        insertionMarkerColour: def.swatch[0] || '#38BDF8',
        insertionMarkerOpacity: 0.8,
        markerColour: def.swatch[1] || '#F472B6',
        cursorColour: '#F8FAFC',
      }
    : {
        workspaceBackgroundColour: '#F3F4FB',
        toolboxBackgroundColour: '#FFFFFF',
        toolboxForegroundColour: '#403C6B',
        flyoutBackgroundColour: '#FFFFFF',
        flyoutForegroundColour: '#403C6B',
        flyoutOpacity: 1,
        scrollbarColour: '#C2C6DB',
        scrollbarOpacity: 0.6,
        insertionMarkerColour: def.swatch[0] || '#4F46E5',
        insertionMarkerOpacity: 0.5,
        markerColour: def.swatch[1] || '#EC2D8F',
        cursorColour: '#1B1840',
      };

  const theme = new Blockly.Theme(`robotku-${tid}-theme`, blockStyles, categoryStyles, compStyles);
  theme.fontStyle = fontStyle;
  THEME_CACHE.set(tid, theme);
  return theme;
}

export function getAstroidTheme(): Blockly.Theme {
  return getRobotkuTheme('robotku');
}

