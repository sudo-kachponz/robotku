// src/pages/index.tsx
//
// Landing Page — Updated mobile dropdown overlay matching exact screenshot benchmark (Hubungi Kami pink button).

import { useState } from 'react';
import Link from 'next/link';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={styles.page}>
      {/* Navbar — Clean White on Desktop, Floating Glass on Mobile */}
      <header className={styles.bar}>
        {!mobileMenuOpen ? (
          <div className={styles.barInner}>
            <img
              className={styles.logo}
              src="/brand/Robotku-Mascot-Logo-Horizontal.png"
              alt="Robotku School"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />

            <div className={styles.headerActions}>
              <a
                href="https://robotku.id"
                target="_blank"
                rel="noreferrer"
                className={styles.navLinkBtn}
              >
                robotku.id ↗
              </a>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              className={styles.hamburgerBtn}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        ) : (
          /* Mobile Expanded Dropdown Overlay Card */
          <div className={styles.mobileExpandedOverlay}>
            <div className={styles.overlayHeader}>
              <img
                className={styles.logo}
                src="/brand/Robotku-Mascot-Logo-Horizontal.png"
                alt="Robotku School"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <button
                className={styles.closeBtn}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={styles.overlayBody}>
              <a
                href="https://robotku.id"
                target="_blank"
                rel="noreferrer"
                className={styles.mobileHubungiBtn}
                onClick={() => setMobileMenuOpen(false)}
              >
                Hubungi Kami
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Full-Screen Hero Container */}
      <main className={styles.main}>
        <section className={styles.heroCard}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>
              SELAMAT DATANG
              <br />
              DI ROBOTKU
              <br />
              PLAYGROUND
            </h1>

            <p className={styles.subtitle}>
              Sekolah coding &amp; robotik untuk anak - anak.{' '}
              <mark className={styles.highlightTag}>#BikinRobotMu&amp;GameMuSendiri</mark>
            </p>

            <div className={styles.heroActions}>
              <Link href="/control" className={styles.btnPrimaryPink}>
                Web Control →
              </Link>
              <Link href="/academy" className={styles.btnSecondaryPink}>
                Robotku Academy →
              </Link>
            </div>
          </div>

          {/* Mascot Right Column with Sparkles and Floating Emojis */}
          <div className={styles.mascotContainer}>
            {/* Yellow Star Sparkle Accents */}
            <svg
              className={`${styles.starSparkle} ${styles.star1}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
            <svg
              className={`${styles.starSparkle} ${styles.star2}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>

            <img className={styles.mascot} src="/brand/Pose1.png" alt="Maskot Robotku" />

            {/* Emojis floating around mascot */}
            <span className={`${styles.floatingEmoji} ${styles.e1}`}>🧩</span>
            <span className={`${styles.floatingEmoji} ${styles.e2}`}>👾</span>
            <span className={`${styles.floatingEmoji} ${styles.e3}`}>🤖</span>
            <span className={`${styles.floatingEmoji} ${styles.e4}`}>🧑🏻‍💻</span>
            <span className={`${styles.floatingEmoji} ${styles.e5}`}>✨</span>
            <span className={`${styles.floatingEmoji} ${styles.e6}`}>👩🏻‍💻</span>
            <span className={`${styles.floatingEmoji} ${styles.e7}`}>🎮</span>
            <span className={`${styles.floatingEmoji} ${styles.e8}`}>🕹️</span>
          </div>
        </section>
      </main>
    </div>
  );
}
