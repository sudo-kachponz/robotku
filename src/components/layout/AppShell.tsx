import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import styles from './AppShell.module.css';

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Pengumuman', href: '/pengumuman' },
    ],
  },
  {
    title: 'Akademik',
    items: [
      { label: 'Jadwal Pelajaran', href: '/akademik/jadwal' },
      { label: 'Nilai Siswa', href: '/akademik/nilai' },
      { label: 'Kehadiran', href: '/akademik/kehadiran' },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { label: 'Data Guru', href: '/master/guru' },
      { label: 'Data Siswa', href: '/master/siswa' },
      { label: 'Mata Pelajaran', href: '/master/mapel' },
    ],
  },
];

interface AppShellProps {
  children: ReactNode;
  pageTitle?: string;
  userName?: string;
  userRole?: string;
}

export default function AppShell({
  children,
  pageTitle = 'Dashboard',
  userName = 'Admin',
  userRole = 'Administrator',
}: AppShellProps) {
  const router = useRouter();

  return (
    <div className={styles.appShell}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          {/* Use Robotku mascot logo if available, otherwise text */}
          <img
            src="/brand/Robotku-Mascot-Logo-Horizontal.webp"
            alt="Robotku Logo"
            className={styles.logo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <h2 className={styles.brandName}>Robotku</h2>
        </div>

        <nav className={styles.sidebarNav}>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <h3 className={styles.navGroupTitle}>{group.title}</h3>
              {group.items.map((item) => {
                const isActive = router.pathname.startsWith(item.href);
                return (
                  <button
                    key={item.label}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={() => router.push(item.href)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <h1 className={styles.topbarTitle}>{pageTitle}</h1>

          <div className={styles.topbarRight}>
            <div className={styles.profileInfo}>
              <div className={styles.userText}>
                <span className={styles.userName}>{userName}</span>
                <span className={styles.userRole}>{userRole}</span>
              </div>
              <div className={styles.avatar}>{userName.charAt(0).toUpperCase()}</div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.contentWrapper}>{children}</main>
      </div>
    </div>
  );
}
