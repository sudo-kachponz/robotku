// src/theme/themeManager.ts
//
// Client-side theme manager and React hook.
// Syncs active theme to localStorage ('robotku.theme'), updates <html>[data-theme],
// and dispatches 'robotku:themechange' events for live updates (Blockly, CM6, UI).

import { useEffect, useState } from 'react';
import {
  type ThemeId,
  THEMES,
  DEFAULT_THEME,
  isValidTheme,
  getTheme,
} from './themes';

const STORAGE_KEY = 'robotku.theme';

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isValidTheme(saved)) {
      return saved;
    }
    // Check system preference on initial launch if nothing saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'space';
    }
  } catch {}
  return DEFAULT_THEME;
}

export function setAppTheme(themeId: ThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    document.documentElement.dataset.theme = themeId;
    window.dispatchEvent(
      new CustomEvent('robotku:themechange', { detail: { theme: themeId } })
    );
  } catch (e) {
    console.error('Failed to set theme', e);
  }
}

export function useAppTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const initial = getStoredTheme();
    setCurrentTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    document.documentElement.dataset.theme = initial;

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeId }>;
      if (customEvent.detail?.theme) {
        setCurrentTheme(customEvent.detail.theme);
      } else {
        setCurrentTheme(getStoredTheme());
      }
    };

    window.addEventListener('robotku:themechange', handleThemeChange);
    return () => {
      window.removeEventListener('robotku:themechange', handleThemeChange);
    };
  }, []);

  return {
    theme: currentTheme,
    themeDef: getTheme(currentTheme),
    setTheme: setAppTheme,
    themes: THEMES,
  };
}
