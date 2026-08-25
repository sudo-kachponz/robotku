// src/pages/index.tsx
//
// Landing Page — Exact benchmark matching robotku.id screenshot:
// Clean white page background, white sticky top navbar, and a single full-screen
// deep-blue rounded card containing hero text, mascot, floating emojis, and primary CTAs.

import Link from 'next/link';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Top Navbar — Clean White */}
      <header className={styles.bar}>
        <img
          className={styles.logo}
          src="/brand/Robotku-Mascot-Logo-Horizontal.png"
          alt="Robotku School"
        />

        <div className={styles.headerActions}>
          <nav className={styles.navLinks}>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Program
            </a>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Testimoni
            </a>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Galeri
            </a>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              FAQ
            </a>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Event
            </a>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Blog
            </a>
          </nav>

          <a
            href="https://wa.me/6285179640032"
            target="_blank"
            rel="noreferrer"
            className={styles.navLinkBtn}
          >
            Hubungi Kami
          </a>
        </div>
      </header>

      {/* Main Full-Screen Hero Container */}
      <main className={styles.main}>
        {/* Single Deep-Blue Hero Card (Rounded, full width) */}
        <section className={styles.heroCard}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>
              SEKOLAH CODING &amp;<br />
              ROBOTIK
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
            <svg className={`${styles.starSparkle} ${styles.star1}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
            <svg className={`${styles.starSparkle} ${styles.star2}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>

            <img
              className={styles.mascot}
              src="/brand/Pose1.png"
              alt="Maskot Robotku"
            />

            {/* Emojis floating around mascot (naik turun animation) */}
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
