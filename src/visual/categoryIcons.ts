// src/visual/categoryIcons.ts
//
// Real category icons for the Block Coding sidebar (Fix 1 in a.md).
// These are lucide icon paths, rendered as inline SVG so they can be injected
// straight into Blockly's imperative toolbox DOM (Blockly builds the category
// rows itself — it is not React, so lucide-react components can't mount there).
// The icon inherits `currentColor`, letting the category renderer set the stroke
// to the category colour (or white when the row is selected).

// Inner markup only (paths); the <svg> wrapper is added by iconSvg() below.
const ICON_PATHS: Record<string, string> = {
  // Movement — steering wheel (a.md's suggested inline wheel).
  Movement:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><path d="M12 5v4.6M4.2 16l4-2.3M19.8 16l-4-2.3"/>',
  // Timing — Clock.
  Timing: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  // Display — Lightbulb.
  Display:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5A6 6 0 1 0 6 8c0 1.5.5 2.8 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  // Audio — Volume2.
  Audio:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  // Sensors & Data — Ruler.
  'Sensors & Data':
    '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  // Program Flow — Network.
  'Program Flow':
    '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
  // Logic — Shuffle.
  Logic:
    '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  // Math — Calculator.
  Math: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  // Variables — Variable.
  Variables:
    '<path d="M8 21s-4-3-4-9 4-9 4-9"/><path d="M16 3s4 3 4 9-4 9-4 9"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>',
  // Functions — SquareFunction.
  Functions:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3"/><path d="M9 11.2h5.7"/>',
  // Templates — ClipboardList.
  Templates:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  // AI — BrainCircuit.
  AI: '<path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M12 8h8"/><path d="M16 8V5a2 2 0 0 1 2-2"/><circle cx="16" cy="13" r=".5"/><circle cx="18" cy="3" r=".5"/><circle cx="20" cy="8" r=".5"/>',
};

/**
 * Build an inline SVG string for a category name, or `null` if we don't have
 * an icon for it (caller then falls back to the coloured dot).
 * Stroke is `currentColor` so the renderer controls the colour.
 */
export function categoryIconSvg(name: string): string | null {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" ` +
    `fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" ` +
    `stroke-linejoin="round">${paths}</svg>`
  );
}
