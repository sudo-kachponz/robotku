// src/pages/index.tsx
//
// Home — two big cards: "Kontrol Robot" (→ /control) and "Robotku Academy"
// (external/stub). Robotku branding: horizontal mascot logo + hero pose.

import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <img
          className={styles.logo}
          src="/brand/Robotku-Mascot-Logo-Horizontal.png"
          alt="Robotku"
        />
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <img className={styles.mascot} src="/brand/Pose1.png" alt="Maskot Robotku" />
          <h1 className={styles.title}>
            Selamat datang di <span className={styles.accent}>Robotku</span>
          </h1>
          <p className={styles.lead}>
            Kendalikan robotmu langsung dari browser. Pilih mode dan coba coding!
          </p>
        </div>

        <div className={styles.cards}>
          <Link href="/control" className={`${styles.card} ${styles.cardPrimary}`}>
            <span className={styles.cardIcon} aria-hidden>
              <RobotIcon />
            </span>
            <span className={styles.cardTitle}>Kontrol Robot</span>
            <span className={styles.cardDesc}>
              Sambungkan robot via Bluetooth atau USB, lalu jelajahi 5 mode kontrol.
            </span>
            <span className={styles.cardCta}>Mulai →</span>
          </Link>

          <a
            className={`${styles.card} ${styles.cardSecondary}`}
            href="https://robotku.id"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // Stub for now — keep the flow on-site if the link is a placeholder.
              if (!confirm('Buka Robotku Academy di tab baru?')) e.preventDefault();
            }}
          >
            <span className={styles.cardIcon} aria-hidden>
              <CapIcon />
            </span>
            <span className={styles.cardTitle}>Robotku Academy</span>
            <span className={styles.cardDesc}>
              Materi belajar, tutorial, dan tantangan robotika.
            </span>
            <span className={styles.cardCta}>Kunjungi ↗</span>
          </a>
        </div>
      </main>

      <footer className={styles.footer}>
        <button
          className={styles.ghostBtn}
          onClick={() => router.push('/control')}
        >
          Web Control
        </button>
        <span className={styles.version}>v1.0.0</span>
      </footer>
    </div>
  );
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
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
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M2 9l10-4 10 4-10 4z" />
      <path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4" />
    </svg>
  );
}
