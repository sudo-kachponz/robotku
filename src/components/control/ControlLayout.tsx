// src/components/control/ControlLayout.tsx
//
// Persistent chrome for every /control/* screen: Home button (top-left),
// connection badge (top-center), Connect power button (bottom-right, green ring
// when connected), Fullscreen (bottom-left), and the bottom dock
// (Projects · Community · Settings). One shared connection drives all modes.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import ConnectionBadge from './ConnectionBadge';
import ConnectPanel from './ConnectPanel';
import { useConnection } from '../../hooks/useConnection';
import styles from './ControlLayout.module.css';

// Configurable external community link (spec: "link to Robotku community").
const COMMUNITY_URL = 'https://robotku.id/community';

export default function ControlLayout({
  children,
  title,
  fullBleed = false,
  topRightAction,
}: {
  children: ReactNode;
  title?: string;
  fullBleed?: boolean;
  topRightAction?: ReactNode;
}) {
  const router = useRouter();
  const { connState } = useConnection();
  const [panelOpen, setPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const connected = connState === 'connected';

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div className={styles.shell}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.topLeft}>
          <button
            className={styles.iconBtn}
            onClick={() => router.push('/')}
            aria-label="Beranda"
            title="Beranda"
          >
            <HomeIcon />
          </button>
        </div>

        <div className={styles.topCenter}>
          {title && <h1 className={styles.screenTitle}>{title}</h1>}
        </div>

        <div className={styles.topRight}>
          {topRightAction}
        </div>
      </header>

      <div className={styles.connectionBadgeContainer}>
        <ConnectionBadge />
      </div>

      {/* Content */}
      <main className={fullBleed ? styles.contentFull : styles.content}>{children}</main>

      {/* Bottom dock */}
      <nav className={styles.dock}>
        <DockButton
          label="Projects"
          active={router.pathname === '/control/projects'}
          onClick={() => router.push('/control/projects')}
        >
          <FolderIcon />
        </DockButton>
        <a className={styles.dockBtn} href={COMMUNITY_URL} target="_blank" rel="noreferrer">
          <CommunityIcon />
          <span>Community</span>
        </a>
        <DockButton
          label="Settings"
          active={router.pathname === '/control/settings'}
          onClick={() => router.push('/control/settings')}
        >
          <GearIcon />
        </DockButton>
      </nav>

      {/* Bottom-left fullscreen */}
      <button
        className={`${styles.cornerBtn} ${styles.fullscreenBtn}`}
        onClick={toggleFullscreen}
        aria-label="Layar penuh"
        title="Layar penuh"
      >
        {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
      </button>

      {/* Bottom-right Connect power button */}
      <button
        className={`${styles.cornerBtn} ${styles.connectBtn} ${
          connected ? styles.connectBtnOn : ''
        }`}
        onClick={() => setPanelOpen(true)}
        aria-label={connected ? 'Robot tersambung' : 'Sambungkan robot'}
        title={connected ? 'Robot tersambung' : 'Sambungkan robot'}
      >
        <PowerIcon />
      </button>

      {panelOpen && <ConnectPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

function DockButton({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const s = active ? `${styles.dockBtn} ${styles.dockBtnActive}` : styles.dockBtn;
  return (
    <button className={s} onClick={onClick}>
      {children}
      <span>{label}</span>
    </button>
  );
}

/* ---- icons ---- */
function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v9h14v-9" />
    </svg>
  );
}
function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 3v9" />
      <path d="M7 6a8 8 0 1 0 10 0" />
    </svg>
  );
}
function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}
function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function CommunityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="9" cy="9" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 6a3 3 0 0 1 0 6" />
      <path d="M18 20a6 6 0 0 0-3-5.2" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  );
}
