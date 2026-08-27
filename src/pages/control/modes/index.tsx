// src/pages/control/modes/index.tsx
//
// Control Modes carousel — 5 cards with left/right arrows + 5 dots. Order:
// Base Robot, Port Control, Tank Mode, Joystick, Block Coding.

import { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import ControlLayout from '../../../components/control/ControlLayout';
import styles from '../../../styles/Modes.module.css';
import baseRobotSvg from '../../../assets/Baserobot.svg';
import portSvg from '../../../assets/Port.svg';
import tankSvg from '../../../assets/tank.svg';
import joystickSvg from '../../../assets/joystick.svg';
import codeSvg from '../../../assets/code.svg';

// Redefine GearIcon if it's not exported
function TopGearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

interface ModeCard {
  key: string;
  href: string;
  title: string;
  desc: string;
  accent: string;
  image: any;
}

const MODES: ModeCard[] = [
  {
    key: 'base',
    href: '/control/modes/base',
    title: 'Base Robot',
    desc: 'Kendali D-pad maju/mundur/belok plus Grab & Release.',
    accent: 'var(--blue)',
    image: baseRobotSvg,
  },
  {
    key: 'port',
    href: '/control/modes/port',
    title: 'Port Control',
    desc: 'Uji 8 port satu per satu lewat slider -100..100.',
    accent: 'var(--purple)',
    image: portSvg,
  },
  {
    key: 'tank',
    href: '/control/modes/tank',
    title: 'Tank Mode',
    desc: 'Dua throttle roda kiri/kanan + belok + turret.',
    accent: 'var(--amber)',
    image: tankSvg,
  },
  {
    key: 'joystick',
    href: '/control/modes/joystick',
    title: 'Joystick',
    desc: 'Satu stik analog + dua tombol aksi, arcade mixing.',
    accent: 'var(--pink-500)',
    image: joystickSvg,
  },
  {
    key: 'code',
    href: '/control/modes/code',
    title: 'Block Coding',
    desc: 'Code your creations!',
    accent: 'var(--indigo-600)',
    image: codeSvg,
  },
];

export default function ModesCarousel() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const card = MODES[i];
  const prev = () => setI((v) => (v - 1 + MODES.length) % MODES.length);
  const next = () => setI((v) => (v + 1) % MODES.length);

  return (
    <ControlLayout
      title="Control Modes"
      fullBleed={true}
      topRightAction={
        <button
          className={styles.navSetting}
          onClick={() => router.push('/control/settings')}
          aria-label="Settings"
        >
          <TopGearIcon />
        </button>
      }
    >
      <div className={styles.fullScreenWrapper} style={{ backgroundColor: card.accent }}>
        <div className={styles.stage}>
          <button className={styles.arrow} onClick={prev} aria-label="Sebelumnya">
            <ChevronLeft />
          </button>

          <div className={styles.contentRow}>
            <div className={styles.illus}>
              <Image
                src={card.image}
                alt={card.title}
                width={300}
                height={300}
                className={styles.cardImage}
              />
            </div>
            <div className={styles.info}>
              <h2 className={styles.title}>{card.title}</h2>
              <p className={styles.desc}>{card.desc}</p>
              <button
                key={`btn-${card.key}`}
                className={styles.enter}
                onClick={() => router.push(card.href)}
              >
                Select
              </button>
            </div>
          </div>

          <button className={styles.arrow} onClick={next} aria-label="Berikutnya">
            <ChevronRight />
          </button>
        </div>

        <div className={styles.lines}>
          {MODES.map((m, idx) => (
            <button
              key={m.key}
              className={`${styles.line} ${idx === i ? styles.lineActive : ''}`}
              onClick={() => setI(idx)}
              aria-label={m.title}
            />
          ))}
        </div>
      </div>
    </ControlLayout>
  );
}

/* ---- icons ---- */
