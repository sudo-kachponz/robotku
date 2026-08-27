// src/components/academy/LessonTile.tsx
//
// Compact lesson tile for the FOLDER view: thumbnail on top, title, a small
// level chip + concept chips, and a status / "Public Link" line.

import { useRouter } from 'next/router';
import type { Lesson } from '../../data/lessons';
import styles from '../../styles/Academy.module.css';
import { Thumb } from './Thumb';
import { StatusChip, LevelChip } from './chips';

export function LessonTile({
  lesson,
  emoji,
  onLocked,
}: {
  lesson: Lesson;
  emoji?: string;
  onLocked?: (lesson: Lesson) => void;
}) {
  const router = useRouter();
  const locked = lesson.status === 'subscribe' || lesson.requiresSubscription;
  const title = lesson.number ? `${lesson.number}. ${lesson.title}` : lesson.title;

  function open() {
    if (locked) onLocked?.(lesson);
    else router.push(`/academy/lessons/${lesson.id}`);
  }

  return (
    <div
      className={styles.tile}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Thumb src={lesson.thumbnail} alt={lesson.title} emoji={emoji} />
      <div className={styles.tileBody}>
        <div className={styles.tileTitle}>{title}</div>
        <div className={styles.tileMetaRow}>
          <LevelChip level={lesson.levelType} />
        </div>
        <div className={styles.tileMetaRow}>
          <StatusChip status={lesson.status} />
        </div>
        <span className={styles.publicLink}>{lesson.status === 'live' ? 'Public Link ↗' : ''}</span>
      </div>
    </div>
  );
}
