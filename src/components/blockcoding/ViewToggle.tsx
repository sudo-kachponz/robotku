// src/components/blockcoding/ViewToggle.tsx
//
// Blocks <-> Python view switch with Puzzle vs Python icons (matching MakeCode style).

import styles from './ViewToggle.module.css';

function PuzzleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z" />
    </svg>
  );
}

function PythonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 110 110"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M54.2 2c-27.1 0-25.5 11.7-25.5 11.7l.1 12.1h26v3.7H18.2S2 27.6 2 54.8c0 27.1 14.2 26.2 14.2 26.2h8.5V69.2s-.5-14.2 13.9-14.2h23.9s13.4.2 13.4-13V15.7S77.8 2 54.2 2zM40 9.8a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2zm15.8 98.2c27.1 0 25.5-11.7 25.5-11.7l-.1-12.1h-26v-3.7h36.6S108 82.4 108 55.2c0-27.1-14.2-26.2-14.2-26.2h-8.5v11.8s.5 14.2-13.9 14.2H47.5s-13.4-.2-13.4 13v26.3s-1.9 13.7 21.7 13.7zm14.2-7.8a4.1 4.1 0 1 1 0-8.2 4.1 4.1 0 0 1 0 8.2z" />
    </svg>
  );
}

export default function ViewToggle({
  mode,
  onChange,
}: {
  mode: 'blocks' | 'python';
  onChange: (m: 'blocks' | 'python') => void;
}) {
  return (
    <div className={styles.toggle} role="tablist" aria-label="Tampilan Blocks atau Python">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'blocks'}
        className={`${styles.toggleBtn} ${mode === 'blocks' ? styles.active : ''}`}
        onClick={() => onChange('blocks')}
        title="Mode Blok"
        aria-label="Mode Blok"
      >
        <PuzzleIcon className={styles.icon} />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'python'}
        className={`${styles.toggleBtn} ${mode === 'python' ? styles.active : ''}`}
        onClick={() => onChange('python')}
        title="Mode Python"
        aria-label="Mode Python"
      >
        <PythonIcon className={styles.icon} />
      </button>
    </div>
  );
}
