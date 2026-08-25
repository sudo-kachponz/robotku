// src/components/academy/AcademyTopBar.tsx
//
// Sticky top bar for the All Lessons page: back-to-Home, Robotku Academy logo +
// title, and the org / active-session / avatar cluster on the right.

import Link from 'next/link';
import styles from '../../styles/Academy.module.css';

export function AcademyTopBar({
  org = 'Robotku School',
  sessions = { active: 1, total: 5 },
  user = 'RU',
}: {
  org?: string;
  sessions?: { active: number; total: number };
  user?: string;
}) {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarBrand}>
        <Link href="/" className={styles.backBtn} aria-label="Kembali ke Beranda">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <img
          className={styles.topbarLogo}
          src="/brand/Robotku-Mascot-Logo-Horizontal.png"
          alt="Robotku Academy"
        />
        <span className={styles.topbarTitle}>Robotku Academy — Semua Pelajaran</span>
      </div>

      <div className={styles.topbarRight}>
        <span className={styles.orgName}>{org}</span>
        <span className={styles.sessionBadge}>
          Sesi aktif: {sessions.active} / {sessions.total}
        </span>
        <span className={styles.avatar}>{user}</span>
      </div>
    </header>
  );
}
