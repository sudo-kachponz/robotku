// src/pages/control/modes/index.tsx
//
// Control Modes carousel — 5 cards with left/right arrows + 5 dots. Order:
// Base Robot, Port Control, Tank Mode, Joystick, Block Coding.

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import ControlLayout from '../../../components/control/ControlLayout';
import styles from '../../../styles/Modes.module.css';

interface ModeCard {
  key: string;
  href: string;
  title: string;
  desc: string;
  accent: string;
  icon: ReactNode;
}

const MODES: ModeCard[] = [
  {
    key: 'base',
    href: '/control/modes/base',
    title: 'Base Robot',
    desc: 'Kendali D-pad maju/mundur/belok plus Grab & Release.',
    accent: 'var(--blue)',
    icon: <DpadIcon />,
  },
  {
    key: 'port',
    href: '/control/modes/port',
    title: 'Port Control',
    desc: 'Uji 8 port satu per satu lewat slider -100..100.',
    accent: 'var(--purple)',
    icon: <SlidersIcon />,
  },
  {
    key: 'tank',
    href: '/control/modes/tank',
    title: 'Tank Mode',
    desc: 'Dua throttle roda kiri/kanan + belok + turret.',
    accent: 'var(--amber)',
    icon: <TankIcon />,
  },
  {
    key: 'joystick',
    href: '/control/modes/joystick',
    title: 'Joystick',
    desc: 'Satu stik analog + dua tombol aksi, arcade mixing.',
    accent: 'var(--pink-500)',
    icon: <StickIcon />,
  },
  {
    key: 'code',
    href: '/control/modes/code',
    title: 'Block Coding',
    desc: 'Susun blok, jalankan program di robot atau simulator.',
    accent: 'var(--indigo-600)',
    icon: <BlocksIcon />,
  },
];

export default function ModesCarousel() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const card = MODES[i];
  const prev = () => setI((v) => (v - 1 + MODES.length) % MODES.length);
  const next = () => setI((v) => (v + 1) % MODES.length);

  return (
    <ControlLayout title="Control Modes">
      <div className={styles.stage}>
        <button className={styles.arrow} onClick={prev} aria-label="Sebelumnya">
          ‹
        </button>

        <div className={styles.card} style={{ borderColor: card.accent }}>
          <div className={styles.illus} style={{ background: card.accent }}>
            {card.icon}
          </div>
          <h2 className={styles.title}>{card.title}</h2>
          <p className={styles.desc}>{card.desc}</p>
          <button className={styles.enter} onClick={() => router.push(card.href)}>
            Enter →
          </button>
        </div>

        <button className={styles.arrow} onClick={next} aria-label="Berikutnya">
          ›
        </button>
      </div>

      <div className={styles.dots}>
        {MODES.map((m, idx) => (
          <button
            key={m.key}
            className={`${styles.dot} ${idx === i ? styles.dotActive : ''}`}
            onClick={() => setI(idx)}
            aria-label={m.title}
          />
        ))}
      </div>
    </ControlLayout>
  );
}

/* ---- icons ---- */
function DpadIcon() { return <svg viewBox="0 0 24 24" width="40" height="40" fill="#fff"><path d="M10 2h4v6h-4zM10 16h4v6h-4zM2 10h6v4H2zM16 10h6v4h-6z" /></svg>; }
function SlidersIcon() { return <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M6 3v6M6 15v6M12 3v10M12 19v2M18 3v2M18 11v10" /><circle cx="6" cy="12" r="2.4" fill="#fff" /><circle cx="12" cy="16" r="2.4" fill="#fff" /><circle cx="18" cy="8" r="2.4" fill="#fff" /></svg>; }
function TankIcon() { return <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="13" width="18" height="6" rx="3" /><circle cx="7" cy="16" r="1.3" fill="#fff" /><circle cx="12" cy="16" r="1.3" fill="#fff" /><circle cx="17" cy="16" r="1.3" fill="#fff" /><rect x="8" y="8" width="8" height="5" rx="1.5" /><path d="M16 10h4" /></svg>; }
function StickIcon() { return <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="3.4" /><path d="M12 11.4V18" /><path d="M7 18h10" /></svg>; }
function BlocksIcon() { return <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="4" width="8" height="6" rx="1.5" /><rect x="13" y="9" width="8" height="6" rx="1.5" /><rect x="6" y="14" width="8" height="6" rx="1.5" /></svg>; }
