// src/theme/fonts.ts
//
// Self-hosted fonts via next/font/google. Next downloads Fredoka + Plus Jakarta
// Sans at BUILD time and serves them from our own origin — zero runtime requests
// to fonts.googleapis.com / fonts.gstatic.com (school WiFi often blocks those).
//
// Exposed as CSS variables consumed by theme/tokens.css. Only the weights the app
// actually uses are bundled (audited from font-weight declarations).

import { Fredoka, Plus_Jakarta_Sans } from 'next/font/google';

export const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-fredoka',
});
