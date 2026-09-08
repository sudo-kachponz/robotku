import React, { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './AppShell.module.css';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Menu Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
      { label: 'Studio Kontrol', href: '/control', icon: '🎮' },
      { label: 'Robotku Academy', href: '/academy', icon: '🎓' },
    ],
  },
  {
    title: 'Mode Robot',
    items: [
      { label: 'Block Coding', href: '/control/modes/code', icon: '🧩' },
      { label: 'Joystick Mode', href: '/control/modes/joystick', icon: '🕹️' },
      { label: 'Base Robot', href: '/control/modes/base', icon: '🤖' },
      { label: 'Tank Mode', href: '/control/modes/tank', icon: '🛡️' },
      { label: 'Port Control', href: '/control/modes/port', icon: '⚡' },
    ],
  },
  {
    title: 'Pengaturan & Proyek',
    items: [
      { label: 'Proyek Saya', href: '/control/projects', icon: '📁' },
      { label: 'Pengaturan Robot', href: '/control/settings', icon: '⚙️' },
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
