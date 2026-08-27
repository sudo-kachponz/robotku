// src/pages/_app.tsx
//
// Next.js Pages Router root. The single place global CSS is allowed to be
// imported. Keeps the app shell minimal — per-route chrome lives in layouts.

import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { DialogHost } from '../ui/dialog';
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
      {/* Default document metadata. Any page can override title/description/og
          by rendering its own next/head — these are just the sensible defaults
          that show up when a teacher shares a bare link on WhatsApp. Absolute
          URLs are required: WhatsApp/Twitter don't resolve a relative og:image. */}
      <Head>
        <title>Robotku Playground — Coding robot lewat blok</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta
          name="description"
          content="Robotku Playground: belajar coding robot lewat blok, jalankan di simulator 2D/3D, lalu sambungkan ke robot ESP32 — untuk kelas dan lab sekolah."
        />
        <meta name="theme-color" content="#4F46E5" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Robotku" />
        <meta property="og:title" content="Robotku Playground — Coding robot lewat blok" />
        <meta
          property="og:description"
          content="Belajar coding robot lewat blok, jalankan di simulator 2D/3D, lalu sambungkan ke robot ESP32. Untuk kelas dan lab sekolah."
        />
        <meta property="og:url" content="https://hub.robotku.id/" />
        <meta property="og:image" content="https://hub.robotku.id/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="id_ID" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Robotku Playground — Coding robot lewat blok" />
        <meta
          name="twitter:description"
          content="Belajar coding robot lewat blok, jalankan di simulator 2D/3D, lalu sambungkan ke robot ESP32."
        />
        <meta name="twitter:image" content="https://hub.robotku.id/og-image.png" />
      </Head>
      <Component {...pageProps} />
      <DialogHost />
    </>
  );
}
