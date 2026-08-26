// src/pages/_app.tsx
//
// Next.js Pages Router root. The single place global CSS is allowed to be
// imported. Keeps the app shell minimal — per-route chrome lives in layouts.

import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { setSettings, subscribeSettings } from '../app/settingsStore';
import { loadSettings, persistSettings } from '../app/persistence';

export default function App({ Component, pageProps }: AppProps) {
  // Hydrate settings from IndexedDB once, then persist future changes.
  useEffect(() => {
    let unsub = () => {};
    loadSettings().then((saved) => {
      if (saved) setSettings(saved);
      let first = true;
      unsub = subscribeSettings((s) => {
        if (first) {
          first = false;
          return; // skip the immediate replay of current state
        }
        void persistSettings(s);
      });
    });
    return () => unsub();
  }, []);

  return (
    <>
      <Head>
        <title>Robotku Playground</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
