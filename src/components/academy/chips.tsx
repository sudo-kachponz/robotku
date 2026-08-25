// src/components/academy/chips.tsx
//
// Small presentational chips used across the Academy: status, level/type, and
// concept tags. Colours follow the Robotku Design System status palette.

import type { LessonStatus } from '../../data/lessons';
import styles from '../../styles/Academy.module.css';

const STATUS_META: Record<LessonStatus, { label: string; className: string }> = {
  live: { label: 'LIVE', className: styles.statusLive },
  coming_soon: { label: 'Coming Soon', className: styles.statusComing },
  subscribe: { label: 'Subscribe', className: styles.statusSubscribe },
};

export function StatusChip({ status }: { status: LessonStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`${styles.chip} ${meta.className}`}>
      <span className={styles.chipDot} />
      {meta.label}
    </span>
  );
}

export function LevelChip({ level }: { level: string }) {
  return <span className={`${styles.chip} ${styles.levelChip}`}>{level}</span>;
}

export function ConceptChip({ concept }: { concept: string }) {
  return <span className={`${styles.chip} ${styles.conceptChip}`}>{concept}</span>;
}
