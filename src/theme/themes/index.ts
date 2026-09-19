// src/theme/themes/index.ts
//
// Registry of all 7 IDE themes (+ default 'robotku').
// Single source of truth for theme metadata, swatches, light/dark mode, and category colors.

export type ThemeId =
  | 'robotku'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'space'
  | 'forest'
  | 'underwater';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  name: string;
  mode: 'light' | 'dark';
  desc: string;
  swatch: [string, string, string]; // [primary, accent/secondary, surface]
  categoryColors: Record<string, string>;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'robotku',
    label: 'Robotku',
    name: 'Robotku (Default)',
    mode: 'light',
    desc: 'Tema standar Robotku dengan palet indigo cerah, aksen pink, dan latar putih bersih.',
    swatch: ['#4F46E5', '#EC2D8F', '#FFFFFF'],
    categoryColors: {
      Movement: '#15803D',
      Timing: '#B45309',
      Display: '#2563EB',
      Audio: '#C2410C',
      'Sensors & Data': '#7C3AED',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#854D0E',
      Functions: '#475569',
      Templates: '#A16207',
      AI: '#BE185D',
    },
  },
  {
    id: 'spring',
    label: 'Spring',
    name: 'Spring',
    mode: 'light',
    desc: 'Nuansa musim semi dengan warna dedaunan segar, bunga mekar, dan langit cerah.',
    swatch: ['#16A34A', '#EC2D8F', '#F0F9F4'],
    categoryColors: {
      Movement: '#15803D',
      Timing: '#B45309',
      Display: '#0369A1',
      Audio: '#C2410C',
      'Sensors & Data': '#7C3AED',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#854D0E',
      Functions: '#3D755C',
      Templates: '#A16207',
      AI: '#BE185D',
    },
  },
  {
    id: 'summer',
    label: 'Summer',
    name: 'Summer',
    mode: 'light',
    desc: 'Kehangatan sinar matahari musim panas, pasir pantai, terumbu karang, dan ombak laut.',
    swatch: ['#D97706', '#E11D48', '#FEF9ED'],
    categoryColors: {
      Movement: '#15803D',
      Timing: '#B45309',
      Display: '#0369A1',
      Audio: '#C2410C',
      'Sensors & Data': '#7E22CE',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#784D28',
      Functions: '#5C3818',
      Templates: '#A16207',
      AI: '#BE123C',
    },
  },
  {
    id: 'autumn',
    label: 'Autumn',
    name: 'Autumn',
    mode: 'light',
    desc: 'Warna musim gugur dengan sentuhan terracotta, tembaga, kayu manis, dan kertas kuno.',
    swatch: ['#C2410C', '#B45309', '#F7F1E8'],
    categoryColors: {
      Movement: '#15803D',
      Timing: '#B45309',
      Display: '#0369A1',
      Audio: '#C2410C',
      'Sensors & Data': '#7E22CE',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#784D28',
      Functions: '#5A3A24',
      Templates: '#A16207',
      AI: '#991B1B',
    },
  },
  {
    id: 'winter',
    label: 'Winter',
    name: 'Winter',
    mode: 'light',
    desc: 'Kesejukan salju kutub, kristal es dingin, safir beku, dan tinta batu tulis yang tegas.',
    swatch: ['#0284C7', '#6366F1', '#EFF6FF'],
    categoryColors: {
      Movement: '#047857',
      Timing: '#B45309',
      Display: '#1D4ED8',
      Audio: '#C2410C',
      'Sensors & Data': '#4F46E5',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#854D0E',
      Functions: '#334155',
      Templates: '#A16207',
      AI: '#BE123C',
    },
  },
  {
    id: 'space',
    label: 'Space',
    name: 'Space (Dark)',
    mode: 'dark',
    desc: 'Ruang angkasa kosmik gelap dengan nebula ungu neon, sian berkilau, dan bintang kejora.',
    swatch: ['#C084FC', '#38BDF8', '#131826'],
    categoryColors: {
      Movement: '#15803D',
      Timing: '#B45309',
      Display: '#2563EB',
      Audio: '#C2410C',
      'Sensors & Data': '#7C3AED',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#854D0E',
      Functions: '#475569',
      Templates: '#A16207',
      AI: '#BE185D',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    name: 'Forest (Dark)',
    mode: 'dark',
    desc: 'Hutan lebat misterius di malam hari dengan dedaunan pinus lumut dan kilau hijau zamrud.',
    swatch: ['#34D399', '#A3E635', '#122019'],
    categoryColors: {
      Movement: '#15803D',
      Timing: '#B45309',
      Display: '#0369A1',
      Audio: '#C2410C',
      'Sensors & Data': '#7C3AED',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#854D0E',
      Functions: '#243F32',
      Templates: '#A16207',
      AI: '#BE185D',
    },
  },
  {
    id: 'underwater',
    label: 'Underwater',
    name: 'Underwater (Dark)',
    mode: 'dark',
    desc: 'Kedalaman laut samudra yang dalam dengan cahaya bioluminescent teal, aqua, dan koral.',
    swatch: ['#22D3EE', '#FB7185', '#0C1F33'],
    categoryColors: {
      Movement: '#047857',
      Timing: '#B45309',
      Display: '#0369A1',
      Audio: '#C2410C',
      'Sensors & Data': '#4F46E5',
      'Program Flow': '#0E7490',
      Logic: '#0F766E',
      Math: '#4338CA',
      Variables: '#854D0E',
      Functions: '#1B3D60',
      Templates: '#A16207',
      AI: '#BE123C',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'robotku';

export function getAllThemes(): ThemeDefinition[] {
  return THEMES;
}

export function getTheme(id?: string): ThemeDefinition {
  if (!id) return THEMES[0];
  const found = THEMES.find((t) => t.id === id);
  return found ?? THEMES[0];
}

export function isValidTheme(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}
