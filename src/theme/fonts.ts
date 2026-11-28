// src/theme/fonts.ts
//
// Self-hosted fonts via next/font/local. The latin variable woff2 files live in
// ./fonts (from Google Fonts, SIL Open Font License), so neither the build nor the
// browser talks to fonts.googleapis.com / fonts.gstatic.com: CI builds failed when the
// Google download hiccuped, and school WiFi often blocks those hosts.
//
// Exposed as CSS variables consumed by theme/tokens.css. Variable fonts: one file
// covers the weight range the app uses (audited from font-weight declarations).

import localFont from 'next/font/local';

export const jakarta = localFont({
  src: './fonts/plus-jakarta-sans-latin.woff2',
  weight: '400 800',
  display: 'swap',
  variable: '--font-jakarta',
});

export const fredoka = localFont({
  src: './fonts/fredoka-latin.woff2',
  weight: '500 700',
  display: 'swap',
  variable: '--font-fredoka',
});
