// src/visual/categoryColors.ts
//
// Single source of truth for category colors & low-saturation flyout tints.

export const CATEGORY_COLORS: Record<string, string> = {
  Movement: '#16A34A',       // Green
  Timing: '#E08600',         // Amber
  Display: '#3B82F6',        // Blue
  Audio: '#F97316',          // Orange
  'Sensors & Data': '#8B5CF6', // Purple
  'Program Flow': '#06B6D4',  // Cyan
  Logic: '#0D9488',          // Teal
  Math: '#4F46E5',            // Indigo
  Variables: '#A16207',       // Brown
  Functions: '#565386',      // Ink Slate
  Templates: '#CA8A04',      // Gold
  AI: '#EC2D8F',             // Pink
};

export const CATEGORY_TINTS: Record<string, string> = {
  Movement: 'rgba(22, 163, 74, 0.16)',
  Timing: 'rgba(224, 134, 0, 0.16)',
  Display: 'rgba(59, 130, 246, 0.16)',
  Audio: 'rgba(249, 115, 22, 0.16)',
  'Sensors & Data': 'rgba(139, 92, 246, 0.16)',
  'Program Flow': 'rgba(6, 182, 212, 0.16)',
  Logic: 'rgba(13, 148, 136, 0.16)',
  Math: 'rgba(79, 70, 229, 0.16)',
  Variables: 'rgba(161, 98, 7, 0.16)',
  Functions: 'rgba(86, 83, 134, 0.16)',
  Templates: 'rgba(202, 138, 4, 0.16)',
  AI: 'rgba(236, 45, 143, 0.16)',
};

export const DEFAULT_FLYOUT_TINT = 'rgba(243, 244, 251, 0.65)';

export function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? '#4F46E5';
}

export function getCategoryTint(name: string): string {
  return CATEGORY_TINTS[name] ?? DEFAULT_FLYOUT_TINT;
}
