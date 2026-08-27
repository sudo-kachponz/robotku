// src/pages/_document.tsx
//
// Custom document with PWA meta tags. Fonts are self-hosted via next/font; their
// CSS-variable classes go on <html> here (NOT on a wrapper div) so that the
// variables exist at :root — tokens.css sets `--font: var(--font-jakarta)` on
// :root and globals.css applies it on `body`, both of which resolve the variable
// at html/body scope. A wrapper div (child of body) would leave body itself on
// the system font and every inherited element with it. No external font requests.

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
