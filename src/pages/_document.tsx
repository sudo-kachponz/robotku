// src/pages/_document.tsx
//
// Custom document with PWA meta tags. Fonts are self-hosted via next/font.
//
// Two things have to be true for them to work, and they live in different files:
//  1. The @font-face + variable-class CSS is only injected on routes whose JS
//     bundle imports the font module — so the import lives in _app.tsx (every
//     page). _document alone does NOT link that CSS globally.
//  2. tokens.css defines --font / --font-display / --font-heading on :root as
//     `var(--font-jakarta)` / `var(--font-fredoka)`. A var() inside a custom
//     property is resolved where that property is DECLARED (:root), not where it
//     is used — so --font-jakarta / --font-fredoka must exist on :root too, or
//     --font-display becomes guaranteed-invalid and every heading silently falls
//     back. That's why the two next/font variable classes go on <html> here (a
//     wrapper div, being a child of body, is too low for the :root indirection).
// No external font requests, so no preconnect needed.

import { Html, Head, Main, NextScript } from 'next/document';
import { fredoka, jakarta } from '../theme/fonts';

export default function Document() {
  return (
    <Html lang="id" className={`${fredoka.variable} ${jakarta.variable}`}>
      <Head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
