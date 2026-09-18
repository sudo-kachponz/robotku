// src/components/blockcoding/ViewToggle.tsx
//
// Blocks <-> Python view switch, sized to sit in the ControlLayout navbar (right).

import styles from './ViewToggle.module.css';

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
        role="tab"
        aria-selected={mode === 'blocks'}
        className={mode === 'blocks' ? styles.active : ''}
        onClick={() => onChange('blocks')}
      >
        Blocks
      </button>
      <button
        role="tab"
        aria-selected={mode === 'python'}
        className={mode === 'python' ? styles.active : ''}
        onClick={() => onChange('python')}
      >
        Python
      </button>
    </div>
  );
}
