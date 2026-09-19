import React, { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './AppShell.module.css';

interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        label: 'Studio Kontrol',
        href: '/control',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="3" />
            <line x1="6" y1="12" x2="10" y2="12" />
            <line x1="8" y1="10" x2="8" y2="14" />
            <circle cx="15" cy="11" r="1" fill="currentColor" />
            <circle cx="18" cy="13" r="1" fill="currentColor" />
          </svg>
        ),
      },
      {
        label: 'Robotku Academy',
        href: '/academy',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Mode Robot',
    items: [
      {
        label: 'Block Coding',
        href: '/control/modes/code',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z" />
          </svg>
        ),
      },
      {
        label: 'Joystick Mode',
        href: '/control/modes/joystick',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="3" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="21" />
            <line x1="3" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="21" y2="12" />
          </svg>
        ),
      },
      {
        label: 'Base Robot',
        href: '/control/modes/base',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <line x1="12" y1="7" x2="12" y2="11" />
            <line x1="7" y1="16" x2="7.01" y2="16" strokeWidth="3" />
            <line x1="17" y1="16" x2="17.01" y2="16" strokeWidth="3" />
          </svg>
        ),
      },
      {
        label: 'Tank Mode',
        href: '/control/modes/tank',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="4" />
            <line x1="7" y1="5" x2="7" y2="19" />
            <line x1="17" y1="5" x2="17" y2="19" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        ),
      },
      {
        label: 'Port Control',
        href: '/control/modes/port',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Pengaturan & Proyek',
    items: [
      {
        label: 'Proyek Saya',
        href: '/control/projects',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
        ),
      },
      {
        label: 'Pengaturan Robot',
        href: '/control/settings',
        icon: (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive mobile detector
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleNavClick = (href: string) => {
    router.push(href);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={styles.appShell}>
      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div className={styles.backdrop} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`${styles.sidebar} ${
          sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed
        }`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brandGroup} onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
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

          <button
            className={styles.sidebarCloseBtn}
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Sembunyikan Sidebar (–)' : 'Tampilkan Sidebar (+)'}
            aria-label="Toggle Sidebar"
          >
            {isMobile ? '✕' : sidebarOpen ? '–' : '+'}
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <h3 className={styles.navGroupTitle}>{group.title}</h3>
              {group.items.map((item) => {
                const isActive = router.pathname === item.href || (item.href !== '/control' && item.href !== '/academy' && router.pathname.startsWith(item.href));
                return (
                  <button
                    key={item.label}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={() => handleNavClick(item.href)}
                  >
                    {item.icon && <span className={styles.navItemIcon}>{item.icon}</span>}
                    <span className={styles.navItemLabel}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.hamburgerBtn}
              onClick={toggleSidebar}
              title={sidebarOpen ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
              aria-label="Menu"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className={styles.topbarTitle}>{pageTitle}</h1>
          </div>

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
