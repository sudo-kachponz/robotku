import { getTheme, type ThemeId } from '../theme/themes';

export const CATEGORY_COLORS: Record<string, string> = {
  Movement: '#15803D', // Green
  Timing: '#B45309', // Amber
  Display: '#2563EB', // Blue
  Audio: '#C2410C', // Orange
  'Sensors & Data': '#7C3AED', // Purple
  'Program Flow': '#0E7490', // Cyan
  Logic: '#0F766E', // Teal
  Math: '#4338CA', // Indigo
  Variables: '#854D0E', // Brown
  Functions: '#475569', // Ink Slate
  Templates: '#A16207', // Gold
  AI: '#BE185D', // Pink
};

export const CATEGORY_TINTS: Record<string, string> = {
  Movement: 'rgba(21, 128, 61, 0.16)',
  Timing: 'rgba(180, 83, 9, 0.16)',
  Display: 'rgba(37, 99, 235, 0.16)',
  Audio: 'rgba(194, 65, 12, 0.16)',
  'Sensors & Data': 'rgba(124, 58, 237, 0.16)',
  'Program Flow': 'rgba(14, 116, 144, 0.16)',
  Logic: 'rgba(15, 118, 110, 0.16)',
  Math: 'rgba(67, 56, 202, 0.16)',
  Variables: 'rgba(133, 77, 14, 0.16)',
  Functions: 'rgba(71, 85, 105, 0.16)',
  Templates: 'rgba(161, 98, 7, 0.16)',
  AI: 'rgba(190, 24, 93, 0.16)',
};

export const DEFAULT_FLYOUT_TINT = 'rgba(243, 244, 251, 0.65)';

function getActiveThemeId(): string {
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-theme') || 'robotku';
  }
  return 'robotku';
}

export function getCategoryColor(name: string, themeId?: string | ThemeId): string {
  const tid = themeId || getActiveThemeId();
  const theme = getTheme(tid);
  return theme.categoryColors[name] ?? CATEGORY_COLORS[name] ?? '#4338CA';
}

export function getCategoryTint(name: string, themeId?: string | ThemeId): string {
  const color = getCategoryColor(name, themeId);
  return color ? `color-mix(in srgb, ${color} 16%, transparent)` : (CATEGORY_TINTS[name] ?? DEFAULT_FLYOUT_TINT);
}

