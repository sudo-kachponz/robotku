// src/visual/theme.ts
//
// Robotku Blockly theme — a LIGHT theme built on the Robotku Design System.
// Replaces the old dark Astroid theme. Colours are the DS palette so categories
// stay distinguishable yet cohesive on a white flyout.

import * as Blockly from 'blockly/core';

// --- Helper: lighten/darken a hex colour for secondary/tertiary shades ---
function adjust(hex: string, amount: number): string {
  const color = Blockly.utils.colour.hexToRgb(hex);
  const a = Math.max(-1, Math.min(1, amount));
  const blend = (c: number) => {
    const v = a >= 0 ? c + (255 - c) * a : c * (1 + a);
    return Math.round(Math.min(255, Math.max(0, v)));
  };
  return Blockly.utils.colour.rgbToHex(blend(color[0]), blend(color[1]), blend(color[2]));
}

// --- DS tokens (kept in sync with src/theme/tokens.css) ---
const DS = {
  bg: '#F3F4FB',
  surface: '#FFFFFF',
  ink700: '#403C6B',
  ink300: '#C2C6DB',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  pink500: '#EC2D8F',
  blue: '#3B82F6',
  green: '#16A34A',
  amber: '#E08600',
  purple: '#8B5CF6',
  orange: '#F97316',
  cyan: '#06B6D4',
  teal: '#0D9488',
  brown: '#A16207',
  inkSlate: '#565386',
  gold: '#CA8A04',
};

// --- FONT: Plus Jakarta Sans, weight 600, size 14 ---
// Bigger + heavier than the old 11/500 so the "code" (block text) reads clearly
// and matches the Robotku DS button typography (Plus Jakarta Sans 600).
const fontStyle: Blockly.Theme.FontStyle = {
  family: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  weight: '600',
  size: 14,
};

// --- Light component styles ---
const lightComponentStyles: Blockly.Theme.ComponentStyle = {
  workspaceBackgroundColour: DS.bg,
  toolboxBackgroundColour: DS.surface,
  toolboxForegroundColour: DS.ink700,
  flyoutBackgroundColour: DS.surface,
  flyoutForegroundColour: DS.ink700,
  flyoutOpacity: 1,
  scrollbarColour: DS.ink300,
  scrollbarOpacity: 0.6,
  insertionMarkerColour: DS.indigo600,
  insertionMarkerOpacity: 0.5,
  markerColour: DS.pink500,
  cursorColour: DS.indigo700,
};

// --- Category -> on-brand block colour mapping (Robotku 12-category map from a.md) ---
// Keys are Blockly *style prefixes*; the loop below expands each into
// `${key}_blocks` (block style) and `${key}_category` (sidebar style). The
// built-in loop/logic/math/variable/procedure/text styles are named to match
// Blockly's own block styles so the reskin covers the standard blocks too.
const categoryColors: Record<string, string> = {
  motors: DS.green,      // Movement
  events: DS.amber,      // Timing (Wait / hat)
  looks: DS.blue,        // Display (LED Matrix + LCD)
  audio: DS.orange,      // Audio
  sensors: DS.purple,    // Sensors & Data
  control: DS.cyan,      // Program Flow (custom control blocks)
  loop: DS.cyan,         // Program Flow (built-in loop blocks)
  logic: DS.teal,        // Logic
  math: DS.indigo600,    // Math
  variable: DS.brown,    // Variables
  procedure: DS.inkSlate,// Functions
  text: DS.blue,         // text fields used across Display/Audio
  templates: DS.gold,    // Templates
  ai: DS.pink500,        // AI (stub)
};

const blockStyles: { [key: string]: Blockly.Theme.BlockStyle } = {};
const categoryStyles: { [key: string]: Blockly.Theme.CategoryStyle } = {};

for (const key in categoryColors) {
  const primary = categoryColors[key];
  blockStyles[`${key}_blocks`] = {
    colourPrimary: primary,
    colourSecondary: adjust(primary, 0.15),
    colourTertiary: adjust(primary, -0.15),
    hat: '',
  };
  categoryStyles[`${key}_category`] = { colour: primary };
}
// Dedicated hat style for the "Start Program" block only, so the amber Timing
// (events_blocks) statements don't all inherit a hat cap.
blockStyles.hat_blocks = {
  colourPrimary: DS.amber,
  colourSecondary: adjust(DS.amber, 0.15),
  colourTertiary: adjust(DS.amber, -0.15),
  hat: 'cap',
};

const RobotkuLightTheme = new Blockly.Theme(
  'robotku-light-theme',
  blockStyles,
  categoryStyles,
  lightComponentStyles,
);
RobotkuLightTheme.fontStyle = fontStyle;

export function getAstroidTheme(): Blockly.Theme {
  return RobotkuLightTheme;
}

// New name for callers migrating off the Astroid branding.
export function getRobotkuTheme(): Blockly.Theme {
  return RobotkuLightTheme;
}
