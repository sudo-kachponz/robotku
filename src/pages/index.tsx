// src/pages/index.tsx
//
// Landing Page — "Selamat Datang di Robotku Lab"
// Deep-indigo marketing hero with Robotku Design System identity,
// white elevation cards, CTA buttons, and floating emojis around the mascot.

import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      {/* Top Navbar */}
      <header className={styles.bar}>
        <img
          className={styles.logo}
          src="/brand/Robotku-Mascot-Logo-Horizontal.png"
          alt="Robotku Logo"
        />
        <div className={styles.headerActions}>
          <nav className={styles.navLinks}>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Program
            </a>
            <Link href="/academy" className={styles.navLink}>
              Academy
            </Link>
            <a href="https://robotku.id" target="_blank" rel="noreferrer" className={styles.navLink}>
              Event
            </a>
          </nav>
          <a
            href="https://robotku.id"
            target="_blank"
            rel="noreferrer"
            className={styles.navLinkBtn}
          >
            <span>robotku.id ↗</span>
          </a>
        </div>
      </header>

      {/* Main Hero & Content */}
      <main className={styles.main}>
        {/* Deep Indigo Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.badgePill}>
              ROBOTKU WEB PLATFORM
            </span>

            <h1 className={styles.title}>
              Selamat Datang di <br />
              <span className={styles.accent}>Robotku Lab</span>
            </h1>

            <p className={styles.lead}>
              Kendalikan robotmu langsung dari browser. Pilih mode dan coba coding!
              <mark className={styles.highlightTag}>#BikinRobotMu</mark>
            </p>

            <div className={styles.heroActions}>
              <Link href="/control" className={styles.btnPrimaryPink}>
                Mulai Sekarang →
              </Link>
              <Link href="/academy" className={styles.btnSecondaryGhost}>
                Buka Academy →
              </Link>
            </div>
          </div>

          {/* Mascot & Surrounding Floating Emojis */}
          <div className={styles.mascotContainer}>
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

        {/* Section Title */}
        <h2 className={styles.sectionHeader}>MODUL & FITUR UTAMA</h2>

        {/* Main Action Cards */}
        <div className={styles.cards}>
          <Link href="/control" className={styles.card}>
            <div className={styles.cardTopRow}>
              <div className={`${styles.cardIcon} ${styles.cardPrimaryIcon}`}>
                <RobotIcon />
              </div>
              <span className={`${styles.statusBadge} ${styles.statusBadgeBlue}`}>
                SIAP DIGUNAKAN
              </span>
            </div>
            <div className={styles.cardBody}>
              <span className={styles.cardTitle}>Web Control</span>
              <span className={styles.cardDesc}>
                Sambungkan robot via Bluetooth atau USB, lalu jelajahi 5 mode kontrol interaktif.
              </span>
            </div>
            <div className={styles.cardFooter}>
              <button className={styles.btnActionPrimary}>
                Mulai →
              </button>
            </div>
          </Link>

          <Link href="/academy" className={styles.card}>
            <div className={styles.cardTopRow}>
              <div className={`${styles.cardIcon} ${styles.cardSecondaryIcon}`}>
                <CapIcon />
              </div>
              <span className={`${styles.statusBadge} ${styles.statusBadgePink}`}>
                MODUL BELAJAR
              </span>
            </div>
            <div className={styles.cardBody}>
              <span className={styles.cardTitle}>Robotku Academy</span>
              <span className={styles.cardDesc}>
                Materi belajar, tutorial interaktif, dan tantangan robotika untuk siswa & pengajar.
              </span>
            </div>
            <div className={styles.cardFooter}>
              <button className={styles.btnActionPink}>
                Buka Academy →
              </button>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className={styles.footerBar}>
        <div className={styles.footerLeft}>
          <a
            href="https://wa.me/6285179640032"
            target="_blank"
            rel="noreferrer"
            className={styles.contactPill}
            title="Hubungi WhatsApp"
          >
            <WhatsAppIcon />
            <span>0851-7964-0032</span>
          </a>

          <a href="https://instagram.com" target="_blank" rel="noreferrer" className={styles.socialIconBtn} title="Instagram">
            <InstagramIcon />
          </a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer" className={styles.socialIconBtn} title="YouTube">
            <YouTubeIcon />
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noreferrer" className={styles.socialIconBtn} title="TikTok">
            <TikTokIcon />
          </a>
        </div>

        <div className={styles.footerRight}>
          <span className={styles.version}>v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}

/* ---- Icons ---- */

function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1.4" />
      <circle cx="9" cy="13" r="1.2" />
      <circle cx="15" cy="13" r="1.2" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}

function CapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M2 9l10-4 10 4-10 4z" />
      <path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}
